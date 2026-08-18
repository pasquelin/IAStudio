import { describe, expect, it } from 'vitest'
import { DOCUMENT_VERSION, type DocumentFile } from '@shared/domain/document'
import { GLTF_STUDIO_KEY, isGltfDocument } from '@shared/domain/gltf'
import { bodyFormatOf, ENVELOPED } from './documentBody'

const scene = bodyFormatOf('.gltf')
const otio = bodyFormatOf('.otio')

const gltf = (studio: Record<string, unknown> = {}): string =>
  JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [], extras: { [GLTF_STUDIO_KEY]: studio } }],
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

    expect(scene.read(scene.write(document))).toEqual(document)
  })

  // Anything the table does not name is the studio's own, which is what keeps a manifest and a
  // kind that does not exist yet reading the same way.
  it('is what an unlisted extension is spelt in', () => {
    expect(bodyFormatOf('.whatever')).toBe(ENVELOPED)
  })
})

describe('a scene held as glTF', () => {
  it('writes the standard file and nothing else', () => {
    const written = scene.write({
      version: 1,
      kind: 'scene',
      title: 'Level',
      updatedAt: '',
      content: gltf({ documentId: 'doc-3', documentKind: 'scene' }),
    })

    // The whole file parses as one document: an envelope would leave a second line no glTF
    // reader has a schema for, and `startsWith('{')` alone cannot tell the two apart.
    expect(isGltfDocument(JSON.parse(written))).toBe(true)
    expect(scene.read(written)).toMatchObject({ kind: 'scene', id: 'doc-3' })
  })

  // The field another application shows, on the scene the document points at — a rename would
  // otherwise leave the old title inside a file the studio has just called something else.
  it('stamps the title into the name the standard holds', () => {
    const written = scene.write({
      version: 1,
      kind: 'scene',
      title: 'Repérage',
      updatedAt: '',
      content: gltf(),
    })

    expect(written).toContain('"name": "Repérage"')
  })

  // The sky wears this extension too, and is still written the studio's own way: what the file
  // holds decides, never the name it wears.
  it('writes the envelope for a document that is not glTF', () => {
    const sky: DocumentFile = {
      version: DOCUMENT_VERSION,
      kind: 'skybox',
      title: 'Ciel',
      updatedAt: '2026-08-18T10:00:00.000Z',
      id: 'doc-9',
      content: '{"adjustments":{}}',
    }

    expect(scene.read(scene.write(sky))).toEqual(sky)
  })

  it('takes the kind from the file, this container serving two editors', () => {
    expect(scene.read(gltf({ documentKind: 'skybox' })).kind).toBe('skybox')
    expect(scene.read(gltf()).kind).toBe('scene')
  })

  it('takes no id from a glTF that carries none', () => {
    expect(scene.read(gltf()).id).toBeUndefined()
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

    expect(otio.read(written)).toMatchObject({ kind: 'sequence', id: 'doc-7' })
    expect(written.startsWith('{')).toBe(true)
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

    expect(otio.read(content)).toEqual({
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
    expect(otio.read(timeline()).id).toBeUndefined()
    expect(otio.read(JSON.stringify({ OTIO_SCHEMA: 'Timeline.1' })).id).toBeUndefined()
  })

  // Refused rather than opened empty: a tab showing nothing is indistinguishable from a new
  // document, and the next ⌘S would write that over whatever the file really held.
  it('refuses a file that is not a timeline', () => {
    expect(() => otio.read('{"OTIO_SCHEMA":"Clip.1"}')).toThrow()
    expect(() => otio.read('not json at all')).toThrow()
  })
})
