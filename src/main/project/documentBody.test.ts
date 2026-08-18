import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DOCUMENT_KIND_KEY,
  DOCUMENT_VERSION,
  ENVELOPE_LIMIT,
  STUDIO_METADATA_KEY,
  type DocumentFile,
} from '@shared/domain/document'
import { isGltfDocument } from '@shared/domain/gltf'
import { ORA_MERGED_PATH } from '@shared/domain/openRaster'
import { packOpenRaster } from '@main/assets/openRasterFile'
import { bodyFormatOf, ENVELOPED } from './documentBody'

/** One transparent pixel, which is all any of this needs to be real PNG bytes. */
const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
)

const scene = bodyFormatOf('.gltf')
const otio = bodyFormatOf('.otio')

/** What `readFile` hands a format: a format reads bytes, whatever the shape of what it wrote. */
const onDisk = (body: string | Uint8Array): Buffer => Buffer.from(body)

/** What a format wrote, as text — every format but OpenRaster writes a string. */
const asText = (body: string | Uint8Array): string =>
  typeof body === 'string' ? body : Buffer.from(body).toString('utf8')

const writeScene = (document: DocumentFile): string => asText(scene.write(document))

/** The four fields every document file carries, so a case states only what it is about. */
const ENVELOPE = {
  version: DOCUMENT_VERSION,
  title: 'Titre',
  updatedAt: '2026-08-18T10:00:00.000Z',
}

const gltf = (studio: Record<string, unknown> = {}): string =>
  JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [], extras: { [STUDIO_METADATA_KEY]: studio } }],
    nodes: [],
  })

const timeline = (studio: Record<string, unknown> = {}): string =>
  JSON.stringify({
    OTIO_SCHEMA: 'Timeline.1',
    name: 'Bande',
    metadata: { scenario: studio },
    global_start_time: null,
    tracks: { OTIO_SCHEMA: 'Stack.1', children: [] },
  })

describe('a document of the studio’s own spelling', () => {
  it('reads back the envelope and the content it wrote', () => {
    const document: DocumentFile = {
      version: DOCUMENT_VERSION,
      kind: 'scene',
      title: 'Level',
      updatedAt: '2026-08-18T10:00:00.000Z',
      id: 'doc-1',
      content: '{"nodes":[]}',
    }

    expect(scene.read(onDisk(scene.write(document)))).toEqual(document)
  })

  // Anything the table does not name is the studio's own, which is what keeps a manifest and a
  // kind that does not exist yet reading the same way.
  it('is what an unlisted extension is spelt in', () => {
    expect(bodyFormatOf('.whatever')).toBe(ENVELOPED)
  })
})

describe('a scene held as glTF', () => {
  /**
   * The migration shim: a `.gltf` a project held before the switch still opens, its envelope on
   * a first line of ours. The format reads the FILE rather than the extension.
   */
  it('still reads a `.gltf` that holds the studio’s own shape', () => {
    const document: DocumentFile = {
      version: DOCUMENT_VERSION,
      kind: 'scene',
      title: 'Level',
      updatedAt: '2026-08-18T10:00:00.000Z',
      id: 'doc-1',
      content: '{"nodes":[]}',
    }

    expect(scene.read(onDisk(asText(ENVELOPED.write(document))))).toEqual(document)
  })

  it('writes the standard file and nothing else', () => {
    const written = writeScene({
      version: 1,
      kind: 'scene',
      title: 'Level',
      updatedAt: '',
      content: gltf({ documentId: 'doc-3', documentKind: 'scene' }),
    })

    // The whole file parses as one document: an envelope would leave a second line no glTF
    // reader has a schema for, and `startsWith('{')` alone cannot tell the two apart.
    expect(isGltfDocument(JSON.parse(written))).toBe(true)
    expect(scene.read(onDisk(written))).toMatchObject({ kind: 'scene', id: 'doc-3' })
  })

  // The field another application shows, on the scene the document points at — a rename would
  // otherwise leave the old title inside a file the studio has just called something else.
  it('stamps the title into the name the standard holds', () => {
    const written = writeScene({
      version: 1,
      kind: 'scene',
      title: 'Repérage',
      updatedAt: '',
      content: gltf(),
    })

    expect(JSON.parse(written).scenes[0].name).toBe('Repérage')
    // Compact: indenting a scene of 5 000 nodes takes its file from 2 396 Ko to 6 840 Ko, and
    // those spaces are parsed again on every open. Measured 18/08.
    expect(written).not.toContain('\n')
  })

  // What the file HOLDS decides, never the name it wears: a document whose content is not glTF
  // falls back on the envelope rather than being refused.
  it('writes the envelope for a document that is not glTF', () => {
    const sky: DocumentFile = {
      version: DOCUMENT_VERSION,
      kind: 'skybox',
      title: 'Ciel',
      updatedAt: '2026-08-18T10:00:00.000Z',
      id: 'doc-9',
      content: '{"adjustments":{}}',
    }

    expect(scene.read(onDisk(scene.write(sky)))).toEqual(sky)
  })

  it('takes the kind from the file, this container serving two editors', () => {
    expect(scene.read(onDisk(gltf({ documentKind: 'skybox' }))).kind).toBe('skybox')
    expect(scene.read(onDisk(gltf())).kind).toBe('scene')
  })

  it('takes no id from a glTF that carries none', () => {
    expect(scene.read(onDisk(gltf())).id).toBeUndefined()
  })

  // Seen on screen: a scene written before the file went compact is indented, so its first line
  // is `{` — read as an envelope, it dropped out of the listing altogether.
  it('reads an indented one, whose first line is not an envelope', () => {
    const indented = JSON.stringify(JSON.parse(gltf({ documentId: 'doc-3' })), null, 2)

    expect(scene.read(onDisk(indented))).toMatchObject({ kind: 'scene', id: 'doc-3' })
  })

  /**
   * `readHead` looks for the studio's mark inside the first `ENVELOPE_LIMIT` bytes and turns away
   * a file that has none. Behind the default scene's list of root nodes the mark fell outside it:
   * a scene of about 1 900 objects at the root was present in the folder, absent from every list,
   * and `locate` could no longer find the file a save had to be written back to.
   */
  it('writes the mark ahead of the list of root nodes, however long that list is', () => {
    const many = JSON.stringify({
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: Array.from({ length: 5_000 }, (_unused, at) => at), extras: {} }],
      nodes: Array.from({ length: 5_000 }, (_unused, at) => ({ name: `Mesh ${at}` })),
    })

    const written = writeScene({
      version: DOCUMENT_VERSION,
      kind: 'scene',
      title: 'Foule',
      updatedAt: '',
      content: many,
    })

    expect(written.indexOf(`"${STUDIO_METADATA_KEY}"`)).toBeLessThan(ENVELOPE_LIMIT)
  })

  /**
   * And however many scenes stand BEFORE the default one. Hoisting the default scene's own extras
   * was not enough: a file whose `scene` is not 0 puts every earlier scene in the way, measured
   * at 47 886 bytes on three scenes of 5 000 nodes — a document present in the folder, absent
   * from every list. This is why the mark rides on `asset`.
   */
  it('writes the mark ahead of the scenes that come before the default one', () => {
    const crowded = JSON.stringify({
      asset: { version: '2.0' },
      scene: 2,
      scenes: [
        { nodes: Array.from({ length: 5_000 }, (_unused, at) => at), extras: {} },
        { nodes: Array.from({ length: 5_000 }, (_unused, at) => at), extras: {} },
        { nodes: [0], extras: {} },
      ],
      nodes: [{ name: 'Rig' }],
    })

    const written = writeScene({
      version: DOCUMENT_VERSION,
      kind: 'scene',
      title: 'Trois scènes',
      updatedAt: '',
      content: crowded,
    })

    expect(written.indexOf(`"${STUDIO_METADATA_KEY}"`)).toBeLessThan(ENVELOPE_LIMIT)
    // The default scene is still the third one: reordering `scenes` would move indices a JSON
    // pointer of `KHR_animation_pointer` is allowed to name.
    expect(JSON.parse(written).scene).toBe(2)
    expect(scene.read(onDisk(written)).kind).toBe('scene')
  })

  /**
   * The mark on `asset` says the kind; the stamp on the scene says everything. Both are read off
   * the same `document`, so they cannot come to disagree — and the mark keeps whatever another
   * application left in `asset.extras`.
   */
  it('marks the asset without dropping the extras it already carried', () => {
    const held = JSON.stringify({
      asset: { version: '2.0', generator: 'Blender', extras: { blender: { flavour: 'cycles' } } },
      scene: 0,
      scenes: [{ nodes: [], extras: {} }],
      nodes: [],
    })

    const written = writeScene({
      version: DOCUMENT_VERSION,
      kind: 'scene',
      title: '',
      updatedAt: '',
      content: held,
    })
    const asset = JSON.parse(written).asset

    // The key the rest of the studio spells a kind with, never one of its own: two spellings of
    // one invariant are free to drift, and nothing reads this copy.
    expect(asset.extras[STUDIO_METADATA_KEY]).toEqual({ [DOCUMENT_KIND_KEY]: 'scene' })
    expect(asset.extras.blender).toEqual({ flavour: 'cycles' })
    expect(asset.generator).toBe('Blender')
  })

  // `in` walks the prototype chain, so a root member with one of those names was dropped.
  it('carries a root member that happens to be named like something on Object.prototype', () => {
    const odd = JSON.stringify({
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [], extras: {} }],
      nodes: [],
      constructor: { kept: true },
      toString: 'kept',
    })

    const written = writeScene({
      version: DOCUMENT_VERSION,
      kind: 'scene',
      title: '',
      updatedAt: '',
      content: odd,
    })

    expect(JSON.parse(written).constructor).toEqual({ kept: true })
    expect(JSON.parse(written).toString).toBe('kept')
  })

  // The mark moved to the front of the scene object; the title still has to win over the name
  // the file arrived with, which is what a rename writes.
  it('still stamps the title over a name the file already had', () => {
    const named = JSON.stringify({
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ name: 'Ancien', nodes: [], extras: { [STUDIO_METADATA_KEY]: {} } }],
      nodes: [],
    })

    const written = writeScene({
      version: DOCUMENT_VERSION,
      kind: 'scene',
      title: 'Nouveau',
      updatedAt: '',
      content: named,
    })

    expect(JSON.parse(written).scenes[0].name).toBe('Nouveau')
  })

  // Everything of ours lives under one key, and the extras a file arrived with are somebody
  // else's — a reordering that dropped them would be a reordering that loses data.
  it('keeps the extras the file arrived with beside the studio’s own', () => {
    const foreign = JSON.stringify({
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [], extras: { blender: { flavour: 'cycles' } } }],
      nodes: [],
    })

    const written = writeScene({
      version: DOCUMENT_VERSION,
      kind: 'scene',
      title: '',
      updatedAt: '',
      content: foreign,
    })

    expect(JSON.parse(written).scenes[0].extras.blender).toEqual({ flavour: 'cycles' })
  })
})

describe('a montage held as OpenTimelineIO', () => {
  // The whole point of the format being the document: nothing of ours may sit in the file, or
  // another application reads a first line it has no schema for.
  it('writes the standard file and nothing else', () => {
    const written = otio.write({
      version: 1,
      kind: 'sequence',
      title: 'Bande',
      updatedAt: '',
      content: timeline({ documentId: 'doc-7' }),
    })

    expect(otio.read(onDisk(written))).toMatchObject({ kind: 'sequence', id: 'doc-7' })
    expect(onDisk(written).toString('utf8').startsWith('{')).toBe(true)
  })

  // The field another application shows. A save already carries the title; a RENAME is what would
  // otherwise leave the old one inside a file the studio has just called something else.
  it('stamps the title into the name the standard holds', () => {
    const written = otio.write({
      version: 1,
      kind: 'sequence',
      title: 'Bande son',
      updatedAt: '',
      content: timeline(),
    })

    expect(written).toContain('"name": "Bande son"')
  })

  /**
   * The one place a save can be stopped. A window that mistook this file's format would put a
   * body no reader understands into it, and the next listing would drop the document from the
   * project altogether — file there, invisible, and no envelope left to recover it from.
   */
  it('refuses to write a body that is not a timeline', () => {
    const draft: Omit<DocumentFile, 'content'> = {
      version: 1,
      kind: 'sequence',
      title: '',
      updatedAt: '',
    }

    expect(() => otio.write({ ...draft, content: '{"tracks":[],"settings":{}}' })).toThrow()
    expect(() => otio.write({ ...draft, content: 'not json at all' })).toThrow()
  })

  it('reads a montage back as a sequence document, content untouched', () => {
    const content = timeline({ documentId: 'doc-7' })

    expect(otio.read(onDisk(content))).toEqual({
      version: DOCUMENT_VERSION,
      kind: 'sequence',
      title: '',
      updatedAt: '',
      id: 'doc-7',
      content,
    })
  })

  /**
   * A file another application wrote knows nothing of our ids. It still opens: the descriptor
   * falls back on the file name, exactly as it does for a document written before version 3.
   */
  it('takes no id from a file that carries none', () => {
    expect(otio.read(onDisk(timeline())).id).toBeUndefined()
    expect(otio.read(onDisk(JSON.stringify({ OTIO_SCHEMA: 'Timeline.1' }))).id).toBeUndefined()
  })

  // Refused rather than opened empty: a tab showing nothing is indistinguishable from a new
  // document, and the next ⌘S would write that over whatever the file really held.
  it('refuses a file that is not a timeline', () => {
    expect(() => otio.read(onDisk('{"OTIO_SCHEMA":"Clip.1"}'))).toThrow()
    expect(() => otio.read(onDisk('not json at all'))).toThrow()
  })
})

/**
 * The image, whose file IS an OpenRaster container. `content` is the stack as JSON and the
 * pixels are `parts` — the one kind whose body is bytes rather than text.
 */
describe('a layered picture held as OpenRaster', () => {
  const ora = bodyFormatOf('.ora')

  const document = (over: Partial<DocumentFile> = {}): DocumentFile => ({
    version: DOCUMENT_VERSION,
    kind: 'image',
    title: 'Planche',
    updatedAt: '2026-08-18T10:00:00.000Z',
    id: 'doc-1',
    content: JSON.stringify({
      width: 64,
      height: 32,
      nodes: [
        {
          kind: 'layer',
          name: 'Encre',
          src: 'data/p_a.png',
          x: 0,
          y: 0,
          opacity: 1,
          visible: true,
          composite: 'svg:src-over',
        },
      ],
      studio: '{"layers":[]}',
    }),
    parts: [
      { path: ORA_MERGED_PATH, png: PNG },
      { path: 'data/p_a.png', png: PNG },
    ],
    ...over,
  })

  it('reads back the stack, the surfaces and the envelope it wrote', () => {
    const written = document()
    const read = ora.read(onDisk(ora.write(written)))

    // The stack goes out as `stack.xml` and comes back parsed, so the JSON is re-spelt: what
    // has to survive is what it MEANS, and comparing the strings would only test key order.
    expect({ ...read, content: JSON.parse(read.content) }).toEqual({
      ...written,
      content: JSON.parse(written.content),
    })
  })

  /** Written whole at every ⌘S, so a stack that lost its surfaces is a picture that lost itself. */
  it('keeps every surface through a write and a read', () => {
    const read = ora.read(onDisk(ora.write(document())))

    expect(read.parts?.map(one => one.path).sort()).toEqual(
      [ORA_MERGED_PATH, 'data/p_a.png'].sort(),
    )
  })

  // A picture GIMP wrote carries no envelope of ours: it is a document all the same, known by
  // its file name exactly as one written before version 3 is.
  it('reads a container that carries no envelope of ours', () => {
    const foreign = packOpenRaster({
      stack: { width: 8, height: 8, nodes: [], studio: '' },
      surfaces: [{ path: ORA_MERGED_PATH, png: PNG }],
    })

    const read = ora.read(Buffer.from(foreign))
    expect(read).toMatchObject({ kind: 'image', title: '' })
    expect(read.id).toBeUndefined()
  })

  it('refuses bytes that are not a container', () => {
    expect(() => ora.read(onDisk('not a zip at all'))).toThrow()
  })
})

describe('a sky held as glTF', () => {
  const skyDocument = (over: Partial<DocumentFile> = {}): DocumentFile => ({
    version: DOCUMENT_VERSION,
    kind: 'skybox',
    title: 'Crépuscule',
    updatedAt: '2026-08-18T10:00:00.000Z',
    id: 'doc-sky',
    content: JSON.stringify({
      asset: { version: '2.0', generator: 'Scenario Studio' },
      scene: 0,
      scenes: [{ name: 'Crépuscule', nodes: [0] }],
      nodes: [{ name: 'Sun' }],
    }),
    ...over,
  })

  /**
   * Kind and id come back; title and clock come back EMPTY, and that is the contract rather than
   * a loss — `foundAt` fills them from the file's own name and the disk's own time. A title baked
   * in here would be the one that goes stale the first time the file is renamed from outside.
   */
  it('reads back the kind and the id it wrote, and the content whole', () => {
    const read = scene.read(onDisk(scene.write(skyDocument())))

    expect(read).toMatchObject({
      kind: 'skybox',
      id: 'doc-sky',
      title: '',
      updatedAt: '',
    })
    // The envelope is stamped INTO `asset.extras`, so the content that comes back holds it: the
    // file is one object, not a line of ours in front of a standard one.
    expect(JSON.parse(read.content)).toMatchObject({ scene: 0, nodes: [{ name: 'Sun' }] })
  })

  /**
   * `asset` goes FIRST and on one line, which is the whole of how a listing reads a project of
   * skies without inflating every one of them. Whitespace is free in JSON, so the file stays
   * valid for every other reader.
   */
  it('puts the envelope on the first line, where a head read reaches it', () => {
    const written = scene.write(skyDocument())
    const head = onDisk(written).toString('utf8')
    const line = head.slice(0, head.indexOf('\n'))

    expect(line.startsWith('{"asset":')).toBe(true)
    expect(JSON.parse(`${line.replace(/,$/, '')}}`)).toMatchObject({
      asset: { extras: { scenario: { documentKind: 'skybox' } } },
    })
  })

  it('is valid JSON a reader that knows nothing of the studio can parse', () => {
    expect(JSON.parse(onDisk(scene.write(skyDocument())).toString('utf8'))).toMatchObject({
      asset: { version: '2.0' },
      scene: 0,
    })
  })

  /**
   * A rename reaches the file, and the title rides where another glTF reader will SHOW it: the
   * default scene's own `name`. Nothing of ours spells it a second time, so nothing can disagree.
   */
  it('renames the default scene rather than stamping a title of its own', () => {
    const written = onDisk(scene.write(skyDocument({ title: 'Aube' }))).toString('utf8')

    expect(JSON.parse(written)).toMatchObject({ scenes: [{ name: 'Aube' }] })
    expect(written).not.toContain('"title"')
  })

  // A `.gltf` from anywhere else claims no kind, and takes the first one the extension names.
  it('reads a glTF that carries no envelope of ours as a scene', () => {
    const read = scene.read(onDisk(JSON.stringify({ asset: { version: '2.0' }, nodes: [] })))

    expect(read).toMatchObject({ kind: 'scene', title: '' })
    expect(read.id).toBeUndefined()
  })
})

describe('a material held as MaterialX', () => {
  const material = bodyFormatOf('.mtlx')

  const materialDocument = (over: Partial<DocumentFile> = {}): DocumentFile => ({
    version: DOCUMENT_VERSION,
    kind: 'texture',
    title: 'Laiton',
    updatedAt: '2026-08-18T10:00:00.000Z',
    id: 'doc-mat',
    content: JSON.stringify({
      images: [
        {
          input: 'base_color',
          type: 'color3',
          file: 'Assets/base.png',
          colorspace: 'srgb_texture',
          tiling: [1, 1],
          offset: [0, 0],
        },
      ],
      values: [{ input: 'specular_roughness', type: 'float', value: 0.5 }],
      studio: { material: { edgeIntensity: 0.4 } },
    }),
    ...over,
  })

  it('writes real MaterialX a reader that knows nothing of the studio can parse', () => {
    const written = asText(material.write(materialDocument()))

    expect(written.startsWith('<?xml version="1.0"?>\n<materialx version="1.39"')).toBe(true)
    expect(written).toContain('<standard_surface name="SR_scenario" type="surfaceshader">')
    expect(written).toContain('<surfacematerial name="scenario_material" type="material">')
  })

  /**
   * Kind and id come back; title and clock come back EMPTY, exactly as a glTF's do — `foundAt`
   * fills them from the file's own name and the disk's own time.
   */
  it('reads back the kind and the id it wrote', () => {
    const read = material.read(onDisk(asText(material.write(materialDocument()))))

    expect(read).toMatchObject({ kind: 'texture', id: 'doc-mat', title: '', updatedAt: '' })
  })

  /** The content is the composed structure and never the file's own text, as a picture's is. */
  it('reads the content back as the structure the editor composed', () => {
    const read = material.read(onDisk(asText(material.write(materialDocument()))))

    expect(JSON.parse(read.content)).toMatchObject({
      images: [{ input: 'base_color', file: 'Assets/base.png' }],
      values: [{ input: 'specular_roughness', value: 0.5 }],
      studio: { material: { edgeIntensity: 0.4 } },
    })
  })

  /**
   * A `.mtlx` written before the switch holds an envelope on a first line of ours. Refusing it
   * would drop every material a project already has out of every listing.
   */
  it('still reads a material written the studio own way', () => {
    const enveloped = ENVELOPED.write(materialDocument({ content: '{"channels":{}}' }))

    expect(material.read(onDisk(asText(enveloped)))).toMatchObject({
      kind: 'texture',
      id: 'doc-mat',
      title: 'Laiton',
    })
  })

  // A `.mtlx` from anywhere else claims no kind, and takes the one its extension names.
  it('reads a MaterialX that carries no attribute of ours as a texture', () => {
    const read = material.read(
      onDisk('<?xml version="1.0"?>\n<materialx version="1.39">\n</materialx>\n'),
    )

    expect(read).toMatchObject({ kind: 'texture', title: '' })
    expect(read.id).toBeUndefined()
  })
})

/**
 * `content` is the whole file, and its ABSENCE is what a cheap listing means: the head answered
 * from the first bytes and never parsed the rest. Asserting the envelope alone would pass either
 * way, which is the difference between a listing that reads eight kilobytes and one that reads
 * every megabyte of the project — ×2,9 on 5 000 scenes, measured 18/08.
 */
describe('what a listing pays per document', () => {
  let root = ''

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'scenario-heads-'))
  })

  const laid = async (name: string, body: string): Promise<string> => {
    const file = join(root, name)
    await writeFile(file, body, 'utf8')
    return file
  }

  /** Past the bound, so the rest of the file is what the short head exists not to read. */
  const wide = (over: Record<string, unknown>): string =>
    JSON.stringify({ asset: { version: '2.0' }, nodes: 'x'.repeat(ENVELOPE_LIMIT), ...over })

  it('reads a scene bigger than the bound without parsing it', async () => {
    const body = writeScene({
      ...ENVELOPE,
      kind: 'scene',
      id: 'doc-9',
      content: wide({ scene: 0, scenes: [{ extras: { [STUDIO_METADATA_KEY]: {} } }] }),
    })
    const head = await scene.readHead(await laid('Niveau.gltf', body))

    expect(body.length).toBeGreaterThan(ENVELOPE_LIMIT)
    expect(head).toMatchObject({ kind: 'scene', id: 'doc-9', title: '', updatedAt: '' })
    expect(head.content).toBeUndefined()
  })

  it('reads a montage bigger than the bound without parsing it', async () => {
    const body = asText(
      otio.write({
        ...ENVELOPE,
        kind: 'sequence',
        id: 'doc-8',
        content: JSON.stringify({
          ...(JSON.parse(timeline()) as Record<string, unknown>),
          spacer: 'x'.repeat(ENVELOPE_LIMIT),
        }),
      }),
    )
    const head = await otio.readHead(await laid('Bande.otio', body))

    expect(body.length).toBeGreaterThan(ENVELOPE_LIMIT)
    expect(head).toMatchObject({ kind: 'sequence', id: 'doc-8' })
    expect(head.content).toBeUndefined()
  })

  /**
   * A bounded read costs an `open`, a `read` and a `close` where reading the file costs one call
   * sized to it — so on a document SMALLER than the bound it was ×0,7, measured 18/08. The bound
   * is read once and its length answers: a file that ended inside it is already in hand.
   */
  it('hands back a document smaller than the bound rather than reading it twice', async () => {
    const body = writeScene({
      ...ENVELOPE,
      kind: 'scene',
      id: 'doc-9',
      content: gltf({ documentId: 'doc-9' }),
    })
    const head = await scene.readHead(await laid('Petite.gltf', body))

    expect(body.length).toBeLessThan(ENVELOPE_LIMIT)
    expect(head).toMatchObject({ kind: 'scene', id: 'doc-9' })
    expect(head.content).toBe(body)
  })

  /** The sky and the scene share the extension, so the head has to say which of the two it is. */
  it('takes the kind off the head rather than off the extension', async () => {
    const file = await laid(
      'Crépuscule.gltf',
      writeScene({
        ...ENVELOPE,
        kind: 'skybox',
        id: 'doc-7',
        content: gltf({ documentId: 'doc-7' }),
      }),
    )

    expect(await scene.readHead(file)).toMatchObject({ kind: 'skybox', id: 'doc-7' })
  })

  /**
   * A scene written before the id was stamped on `asset` carries it beside its whole state, which
   * does not fit in the head — so the file is read, exactly as it was. The fallback is what keeps
   * every such document listed rather than renamed to its own file name.
   */
  it('reads a scene whose id sits behind more than the head holds', async () => {
    const wide = JSON.stringify({
      asset: { version: '2.0', extras: { [STUDIO_METADATA_KEY]: { documentKind: 'scene' } } },
      scene: 0,
      scenes: [
        {
          extras: {
            [STUDIO_METADATA_KEY]: {
              scene: { nodes: 'x'.repeat(ENVELOPE_LIMIT) },
              documentId: 'doc-6',
            },
          },
        },
      ],
    })

    const head = await scene.readHead(await laid('Vaste.gltf', wide))

    expect(head).toMatchObject({ kind: 'scene', id: 'doc-6' })
    expect(head.content).toBe(wide)
  })

  it('still answers the envelope of a document written before the switch', async () => {
    const file = await laid(
      'Ancienne.gltf',
      `${JSON.stringify({ ...ENVELOPE, kind: 'scene', id: 'doc-5', title: 'Ancienne' })}\n{"nodes":[]}`,
    )

    expect(await scene.readHead(file)).toMatchObject({
      kind: 'scene',
      id: 'doc-5',
      title: 'Ancienne',
    })
  })

  it('turns away a glTF another application exported into the project', async () => {
    const file = await laid(
      'Maille.gltf',
      JSON.stringify({ asset: { version: '2.0' }, meshes: [] }),
    )

    await expect(scene.readHead(file)).rejects.toThrow()
  })

  /** A title holding a brace must not end the block the head is matching. */
  it('reads the head of a montage whose name holds a brace', async () => {
    const file = await laid(
      'Accolade.otio',
      asText(
        otio.write({
          ...ENVELOPE,
          kind: 'sequence',
          id: 'doc-4',
          title: 'Plan { serré }',
          content: timeline(),
        }),
      ),
    )

    expect(await otio.readHead(file)).toMatchObject({ kind: 'sequence', id: 'doc-4' })
  })
})
