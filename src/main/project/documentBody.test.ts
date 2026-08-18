import { describe, expect, it } from 'vitest'
import { DOCUMENT_VERSION, type DocumentFile } from '@shared/domain/document'
import { bodyFormatOf, ENVELOPED } from './documentBody'

const scene = bodyFormatOf('.scene')
const otio = bodyFormatOf('.otio')

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

  // Anything the table does not name is the studio's own, which is what keeps a manifest, a
  // `.scene` and a kind that does not exist yet reading the same way.
  it('is what an unlisted extension is spelt in', () => {
    expect(bodyFormatOf('.whatever')).toBe(ENVELOPED)
    expect(scene).toBe(ENVELOPED)
  })
})

describe('a montage held as OpenTimelineIO', () => {
  // The whole point of the format being the document: nothing of ours may sit in the file, or
  // another application reads a first line it has no schema for.
  it('writes the standard file and nothing else', () => {
    const content = timeline()
    expect(otio.write({ version: 1, kind: 'sequence', title: '', updatedAt: '', content })).toBe(
      content,
    )
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
