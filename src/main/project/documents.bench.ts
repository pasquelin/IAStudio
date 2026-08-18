import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { deserialize, serialize } from 'node:v8'
import { afterAll, bench, describe } from 'vitest'
import {
  DOCUMENT_VERSION,
  EXTENSIONS_BY_KIND,
  STUDIO_METADATA_KEY,
  type DocumentFile,
} from '@shared/domain/document'
import { GLTF_SCENE_STATE } from '@shared/domain/gltf'
// The production read and the production pool, not copies of them: this bench measures the exact
// syscall shape `list()` takes, and a second implementation beside it would drift from the one
// being measured. It did — `headOf` was copied here without its envelope parse, so the pool was
// timed against a lighter read than the one it runs.
import { headOf, pooledHeads } from './documents'
import { bodyFormatOf } from './documentBody'

/**
 * What one save and one open cost the main process.
 *
 * The scene stopped being free the day it became glTF: writing one PARSES the whole body and
 * writes it back indented, to stamp the title into the field a reader shows. Measured 18/08 —
 * 19 ms at 5 000 nodes and 190 ms at 50 000, against 9 and 88 for the envelope it replaced. The
 * montage pays the same price for the same reason, on a body an order of magnitude smaller.
 *
 * The comparison is the point of keeping this: `stringify` of the whole file is measured beside
 * it, and it is what the main thread used to pay per save. A main thread busy for more than
 * 16 ms freezes every window of the studio, detached ones included — CLAUDE.md, invariant 6.
 * `node:v8` is the serializer Electron's IPC uses.
 *
 * `createDocumentFiles` itself is not called: what is measured is its synchronous half, and the
 * `writeFile`/`rename` around it are asynchronous and off the JS thread.
 */
function sceneOf(count: number): DocumentFile {
  const nodes = Array.from({ length: count }, (_unused, index) => ({
    id: `node_${index}`,
    parentId: null,
    name: `Mesh ${index}`,
    visible: true,
    transform: {
      position: { x: index, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    type: 'mesh',
    geometry: { kind: 'sphere', radius: 0.5, widthSegments: 32, heightSegments: 16 },
    material: {
      kind: 'standard',
      color: null,
      roughness: 1,
      metalness: 0,
      map: { assetId: 'asset_00000000-0000-0000-0000-000000000000' },
      normalMap: null,
      roughnessMap: null,
      metalnessMap: null,
      aoMap: null,
    },
  }))

  return {
    version: DOCUMENT_VERSION,
    kind: 'scene',
    title: 'Bench',
    updatedAt: '2026-08-07T10:00:00.000Z',
    // The spelling the window actually sends since the scene became glTF, and the reason this
    // bench is worth rerunning: writing one PARSES it, to stamp the title into the standard.
    // Written out rather than imported — `gltfDocumentOf` lives in the window, which this side
    // of the boundary cannot reach.
    content: JSON.stringify({
      asset: { version: '2.0', generator: 'Bench' },
      scene: 0,
      scenes: [
        {
          nodes: nodes.map((_unused, index) => index),
          extras: { [STUDIO_METADATA_KEY]: { [GLTF_SCENE_STATE]: { nodes } } },
        },
      ],
      nodes: nodes.map(node => ({ name: node.name })),
    }),
  }
}

const SCENE = bodyFormatOf(EXTENSIONS_BY_KIND.scene)
const OTIO = bodyFormatOf(EXTENSIONS_BY_KIND.sequence)

const SIZES: readonly number[] = [50, 500, 5_000, 10_000, 15_000, 50_000]

describe('writing a document: the whole main-thread cost of one save', () => {
  for (const count of SIZES) {
    const clone = serialize(sceneOf(count))
    bench(`${count} nodes`, () => {
      SCENE.write(deserialize(clone))
    })
  }
})

// What the main thread used to pay per save, kept as the measure of what was moved out of it.
describe('writing a document: serializing the content, as it no longer does', () => {
  for (const count of SIZES) {
    const file = sceneOf(count)
    bench(`${count} nodes`, () => {
      JSON.stringify(JSON.parse(file.content))
    })
  }
})

describe('reading a document: the whole main-thread cost of one open', () => {
  for (const count of SIZES) {
    const body = SCENE.write(sceneOf(count))
    bench(`${count} nodes`, () => {
      serialize(SCENE.read(body))
    })
  }
})

/**
 * What listing a project of 2 000 documents across 200 folders costs, three ways.
 *
 * This is the measure that decides how `list()` is written, and it is here rather than argued
 * about: the walk opens the head of every candidate, so the question is whether the opens have
 * to be spread over a pool and whether a `stat` cache is worth the second syscall it adds. A
 * main thread busy for more than 16 ms freezes every window — CLAUDE.md, invariant 6 — but this
 * runs off the thread's critical path, so the number that matters is how long a reader waits.
 *
 * Written on a temporary folder rather than mocked: what is being compared is syscall shape, and
 * a mock would compare nothing.
 *
 * **Measured 2026-08-17** (macOS, APFS, Node 24): 117 ms one at a time, 35 ms over a pool of 16,
 * 19 ms when every head is cached.
 *
 * **The conclusion drawn from those three was wrong, and it is the fixture that made it wrong**:
 * these files carry an enveloped head followed by four thousand `x`, so a head costs an `open`
 * and 8 Ko. A scene the studio writes is a glTF, whose head is the WHOLE FILE parsed — the group
 * below measures that. `headOf` keeps what it read since 18/08; what it saves here is half, and
 * what it saves on a project of scenes is all of it.
 */
const DOCUMENT_COUNT = 2_000
const FOLDER_COUNT = 200
/** What the labels say. The pool itself is `pooledHeads`, and its size lives with it. */
const POOL = 16

/**
 * Laid down once, on the first bench that asks for it — `beforeAll` is not honoured by
 * `vitest bench`, which is why this is a promise rather than a hook.
 */
let laid: Promise<string> | null = null

/** The envelope a real document carries, as one line — the only part any of these three reads. */
const HEAD = `${JSON.stringify({
  version: DOCUMENT_VERSION,
  kind: 'scene',
  id: 'a3f1',
  title: 'Bench',
  updatedAt: '2026-08-17T10:00:00.000Z',
})}\n${'x'.repeat(4_000)}`

async function layDown(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'scenario-list-bench-'))
  const perFolder = DOCUMENT_COUNT / FOLDER_COUNT

  for (let folder = 0; folder < FOLDER_COUNT; folder += 1) {
    // Two levels deep, as a project organised by hand ends up: `Act 3/Ruelles/`.
    const path = join(root, `Act ${folder % 20}`, `Scene ${folder}`)
    await mkdir(path, { recursive: true })
    await Promise.all(
      Array.from({ length: perFolder }, async (_unused, file) => {
        await writeFile(join(path, `document ${file}${EXTENSIONS_BY_KIND.scene}`), HEAD, 'utf8')
        // Half the folder is something else, which is what filtering before any open is for.
        await writeFile(join(path, `still ${file}.png`), 'not a document', 'utf8')
      }),
    )
  }

  return root
}

/** Every scene under the root, found by one recursive `readdir` — what all three then read. */
async function candidates(): Promise<string[]> {
  const root = await (laid ??= layDown())
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith(EXTENSIONS_BY_KIND.scene))
    .map(entry => join(entry.parentPath, entry.name))
}

describe('listing a project of 2 000 documents in 200 folders', () => {
  afterAll(async () => {
    if (laid) await rm(await laid, { recursive: true, force: true })
  })

  bench('one head at a time', async () => {
    const found = await candidates()
    for (const file of found) await headOf(file)
  })

  bench(`${POOL} heads in flight`, async () => {
    await pooledHeads(await candidates(), headOf)
  })

  // The cache as it would be: a `stat` says nothing moved, and the head is not opened at all.
  // It replaces one `open`/`read`/`close` with one `stat`, and that is the whole trade.
  bench(`${POOL} heads in flight, all of them cached`, async () => {
    await pooledHeads(await candidates(), file => stat(file))
  })
})

/**
 * The head of a scene the studio wrote, which is a COMPACT glTF — and there is nothing short to
 * read in one. Its first line is the whole file, so `readHead` falls through to reading and
 * parsing all of it, exactly as a montage does.
 *
 * Measured rather than deduced: the two comments beside this one say a scene is "kept from
 * paying" that parse, and the three listing benches above lay down enveloped heads followed by
 * four thousand `x` — a fixture that cannot show this at all.
 *
 * `locate` verifies through `descriptorOf`, so ONE save pays this on top of its own write.
 */
const HEAD_SIZES: readonly number[] = [50, 500, 5_000, 15_000]

/** Laid down once, for the same reason `laid` is: `vitest bench` honours no `beforeAll`. */
let scenes: Promise<Map<number, string>> | null = null

async function laySceneFiles(): Promise<Map<number, string>> {
  const root = await mkdtemp(join(tmpdir(), 'scenario-head-bench-'))
  const written = new Map<number, string>()

  for (const count of HEAD_SIZES) {
    const file = join(root, `scene ${count}${EXTENSIONS_BY_KIND.scene}`)
    await writeFile(file, SCENE.write(sceneOf(count)), 'utf8')
    written.set(count, file)
  }

  return written
}

describe('reading the head of a scene: what one glTF costs a listing, and a save', () => {
  afterAll(async () => {
    const written = await scenes
    const first = written ? [...written.values()][0] : null
    if (first) await rm(dirname(first), { recursive: true, force: true })
  })

  for (const count of HEAD_SIZES) {
    bench(`${count} nodes`, async () => {
      const file = (await (scenes ??= laySceneFiles())).get(count)
      if (file) await SCENE.readHead(file)
    })
  }

  // The same head through `headOf`, which is what `locate` and the walk actually call: it keeps
  // what it read against the file's modification time, so everything past the first ask is one
  // `stat`. That first ask is in here too — it is one sample out of hundreds.
  for (const count of HEAD_SIZES) {
    bench(`${count} nodes, through headOf`, async () => {
      const file = (await (scenes ??= laySceneFiles())).get(count)
      if (file) await headOf(file)
    })
  }
})

const CLIP_COUNTS: readonly number[] = [50, 500, 5_000]

/**
 * The price of the format BEING the document: an `.otio` carries no head of ours, so listing one
 * reads and parses the whole file — the very parse a scene is kept from paying.
 *
 * **Measured 2026-08-18** (macOS, Node 24): 0.09 ms at 50 clips, 0.92 ms at 500, 9.4 ms at 5 000.
 * A project of a few ordinary montages stays under the 16 ms a frame has; several of the largest
 * would not, and `list()` runs on the thread that owns every window.
 *
 * **And one gesture used to pay it more than once**: `locate` verifies through `descriptorOf`,
 * so an open cost two of these and a rename four. Since 18/08 `headOf` keeps what it read against
 * the file's modification time, so only the first of them opens anything.
 */
describe('reading a montage: the head that has to be the whole file', () => {
  for (const count of CLIP_COUNTS) {
    const body = otioOf(count)
    bench(`${count} clips (${Math.round(body.length / 1024)} KiB)`, () => {
      OTIO.read(body)
    })
  }
})

function otioOf(count: number): string {
  const time = (value: number): unknown => ({ OTIO_SCHEMA: 'RationalTime.1', rate: 25, value })

  return JSON.stringify({
    OTIO_SCHEMA: 'Timeline.1',
    name: 'Bench',
    metadata: { scenario: { documentId: 'a3f1', width: 1920, height: 1080, sampleRate: 48_000 } },
    global_start_time: time(0),
    tracks: {
      OTIO_SCHEMA: 'Stack.1',
      name: 'tracks',
      metadata: {},
      children: [
        {
          OTIO_SCHEMA: 'Track.1',
          name: 'V1',
          kind: 'Video',
          metadata: {},
          enabled: true,
          children: Array.from({ length: count }, (_unused, index) => ({
            OTIO_SCHEMA: 'Clip.1',
            name: `Plan ${index}`,
            metadata: {
              scenario: {
                id: `clip_${index}`,
                assetId: 'asset_00000000-0000-0000-0000-000000000000',
                start: index * 1_000_000,
                duration: 1_000_000,
                inPoint: 0,
                fadeIn: 0,
                fadeOut: 0,
                gain: 0,
              },
            },
            source_range: { OTIO_SCHEMA: 'TimeRange.1', start_time: time(0), duration: time(25) },
            markers: [],
            enabled: true,
            effects: [],
            media_reference: {
              OTIO_SCHEMA: 'ExternalReference.1',
              name: `Plan ${index}`,
              metadata: {},
              available_range: null,
              target_url: `../assets/vid/plan%20${index}.mp4`,
            },
          })),
        },
      ],
    },
  })
}
