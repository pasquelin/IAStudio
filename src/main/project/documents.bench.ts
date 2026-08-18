import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deserialize, serialize } from 'node:v8'
import { afterAll, bench, describe } from 'vitest'
import { DOCUMENT_VERSION, EXTENSIONS_BY_KIND, type DocumentFile } from '@shared/domain/document'
// The production read and the production pool, not copies of them: this bench measures the exact
// syscall shape `list()` takes, and a second implementation beside it would drift from the one
// being measured. It did — `headOf` was copied here without its envelope parse, so the pool was
// timed against a lighter read than the one it runs.
import { headOf, pooledHeads } from './documents'
import { bodyFormatOf } from './documentBody'
import { createHeadCache } from './headCache'

/**
 * What one save and one open cost the main process.
 *
 * One cost per save now, not two: the content arrives already serialized, so all the main
 * thread does is decode the structured clone `ipcMain` hands it and concatenate two strings.
 * The `JSON.stringify` of the document itself happens in the window that owns it.
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
    // Already a string when it crosses the boundary — that is the whole point of the format.
    content: JSON.stringify({ nodes }),
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
    // As `readFile` hands it over: the format reads bytes, and decoding them is part of an open.
    const body = Buffer.from(SCENE.write(sceneOf(count)))
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
 * **Measured 2026-08-18** (macOS, APFS, Node 24, a busy machine): 279 ms one at a time, 143 ms
 * over a pool of 16, 45 ms when every head is cached. The 2026-08-17 run of the same three read
 * 117 / 35 / 19 — three times faster across the board and the same shape, which is what a
 * measure taken beside four other sessions is worth.
 *
 * The cache is written now, and the montages below are why: an enveloped head is a bounded read
 * this saves a third of, where an `.otio` has no head at all and is parsed whole every time.
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

  // The cache itself, not a stand-in for it — this used to be a bare `stat`, which timed the
  // syscall and none of the map around it. Warm from the first iteration onwards, which is the
  // state a second listing of a project finds it in.
  const warm = createHeadCache(headOf)
  bench(`${POOL} heads in flight, all of them cached`, async () => {
    await pooledHeads(await candidates(), file => warm.read(file))
  })
})

/**
 * The same listing over MONTAGES, which is where the cache stops being a third and becomes the
 * difference between a listing and a freeze: an `.otio` carries no head of ours, so the pool
 * parses every one of them whole.
 *
 * 200 rather than 2 000: a project holds far fewer cuts than stills, and 2 000 montages of 500
 * clips would be 58 MB of JSON laid down for every run of the bench.
 *
 * **Measured 2026-08-18**: 201 ms over the pool, 1.48 ms through the cache. Read as a RATIO and
 * not as two absolute numbers — the same three benches above moved by three between two runs
 * twenty minutes apart on this machine, four other sessions being what changed.
 */
const MONTAGE_COUNT = 200
let laidMontages: Promise<string> | null = null

async function layMontages(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'scenario-otio-bench-'))
  const body = otioOf(500)
  await Promise.all(
    Array.from({ length: MONTAGE_COUNT }, (_unused, index) =>
      writeFile(join(root, `Bande ${index}${EXTENSIONS_BY_KIND.sequence}`), body, 'utf8'),
    ),
  )
  return root
}

async function montages(): Promise<string[]> {
  const root = await (laidMontages ??= layMontages())
  return (await readdir(root)).map(name => join(root, name))
}

describe(`listing ${MONTAGE_COUNT} montages of 500 clips`, () => {
  afterAll(async () => {
    if (laidMontages) await rm(await laidMontages, { recursive: true, force: true })
  })

  bench(`${POOL} heads in flight`, async () => {
    await pooledHeads(await montages(), headOf)
  })

  const warm = createHeadCache(headOf)
  bench(`${POOL} heads in flight, all of them cached`, async () => {
    await pooledHeads(await montages(), file => warm.read(file))
  })
})

const CLIP_COUNTS: readonly number[] = [50, 500, 5_000]

/**
 * The price of the format BEING the document: an `.otio` carries no head of ours, so listing one
 * reads and parses the whole file — the very parse a scene is kept from paying.
 *
 * **Measured 2026-08-18** (macOS, Node 24): 0.13 ms at 50 clips, 1.66 ms at 500, 17.3 ms at 5 000.
 * A project of a few ordinary montages stays under the 16 ms a frame has; several of the largest
 * would not, and `list()` runs on the thread that owns every window.
 *
 * **One gesture used to pay it more than once**: `locate` verified through `descriptorOf`, so an
 * open cost two of these and a rename four. `documents.reads.test.ts` counts them, and both are
 * one now — `locate` hands back what it read instead of dropping it.
 */
describe('reading a montage: the head that has to be the whole file', () => {
  for (const count of CLIP_COUNTS) {
    const body = Buffer.from(otioOf(count))
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
