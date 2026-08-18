import { describe, expect, it } from 'vitest'
import { DOCUMENT_VERSION, type DocumentFile } from '@shared/domain/document'
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

  /**
   * The migration shim, and it is what makes the sky's lot landable on its own: two kinds wear
   * `.gltf`, the sky is written as real glTF today and the scene is not, so the format reads the
   * FILE rather than the extension. A `.gltf` written yesterday still opens.
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

    expect(scene.read(onDisk(ENVELOPED.write(document)))).toEqual(document)
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
   * The WHOLE envelope comes back, clock included — unlike a montage's, whose envelope is not in
   * the file at all. A rename rewrites the body from what a read answered, so a field dropped here
   * is a field the rename writes empty: the head reader then refuses the file, and the document
   * vanishes from every listing while sitting on disk.
   */
  it('reads back the envelope it wrote, and the content whole', () => {
    const document = skyDocument()
    const read = scene.read(onDisk(scene.write(document)))

    expect(read).toMatchObject({
      kind: 'skybox',
      id: 'doc-sky',
      title: document.title,
      updatedAt: document.updatedAt,
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
      asset: { extras: { scenario: { kind: 'skybox', id: 'doc-sky' } } },
    })
  })

  it('is valid JSON a reader that knows nothing of the studio can parse', () => {
    expect(JSON.parse(onDisk(scene.write(skyDocument())).toString('utf8'))).toMatchObject({
      asset: { version: '2.0' },
      scene: 0,
    })
  })

  /** A rename has to reach the envelope, not only the file's own name on disk. */
  it('carries the title into the envelope on every write', () => {
    expect(onDisk(scene.write(skyDocument({ title: 'Aube' }))).toString('utf8')).toContain(
      '"title":"Aube"',
    )
  })

  // A `.gltf` from anywhere else claims no kind, and takes the first one the extension names.
  it('reads a glTF that carries no envelope of ours as a scene', () => {
    const read = scene.read(onDisk(JSON.stringify({ asset: { version: '2.0' }, nodes: [] })))

    expect(read).toMatchObject({ kind: 'scene', title: '' })
    expect(read.id).toBeUndefined()
  })
})
