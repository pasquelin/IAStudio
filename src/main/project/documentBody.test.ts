import { describe, expect, it } from 'vitest'
import { DOCUMENT_VERSION, type DocumentFile } from '@shared/domain/document'
import { bodyOf, documentFrom, readsWhole } from './documentBody'

const SCENE = '.scene'
const OTIO = '.otio'

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

    expect(documentFrom(bodyOf(document, SCENE), SCENE)).toEqual(document)
  })
})

describe('a montage held as OpenTimelineIO', () => {
  // The whole point of the format being the document: nothing of ours may sit in the file, or
  // another application reads a first line it has no schema for.
  it('writes the standard file and nothing else', () => {
    const content = timeline()
    expect(bodyOf({ version: 1, kind: 'sequence', title: '', updatedAt: '', content }, OTIO)).toBe(
      content,
    )
  })

  it('reads a montage back as a sequence document, content untouched', () => {
    const content = timeline({ documentId: 'doc-7' })

    expect(documentFrom(content, OTIO)).toEqual({
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
    expect(documentFrom(timeline(), OTIO).id).toBeUndefined()
    expect(documentFrom(JSON.stringify({ OTIO_SCHEMA: 'Timeline.1' }), OTIO).id).toBeUndefined()
  })

  // Refused rather than opened empty: a tab showing nothing is indistinguishable from a new
  // document, and the next ⌘S would write that over whatever the file really held.
  it('refuses a file that is not a timeline', () => {
    expect(() => documentFrom('{"OTIO_SCHEMA":"Clip.1"}', OTIO)).toThrow()
    expect(() => documentFrom('not json at all', OTIO)).toThrow()
  })

  it('is the one spelling whose head cannot be read short', () => {
    expect(readsWhole(OTIO)).toBe(true)
    expect(readsWhole(SCENE)).toBe(false)
  })
})
