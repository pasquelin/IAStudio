import { describe, expect, it } from 'vitest'
import { DOCUMENT_VERSION } from '@shared/domain/document'
import {
  parseDocumentDraft,
  parseDocumentFile,
  parseDocumentId,
  parseDocumentKind,
} from './validation'

const valid = {
  version: DOCUMENT_VERSION,
  kind: 'scene',
  title: 'Untitled',
  updatedAt: '2026-08-07T10:00:00.000Z',
  content: { nodes: [] },
}

describe('parseDocumentId', () => {
  it('accepts an ordinary id', () => {
    expect(parseDocumentId('doc_a3f1')).toBe('doc_a3f1')
  })

  // The id ends up in a path, and the renderer is what supplies it.
  it('refuses anything that would walk out of the documents folder', () => {
    expect(() => parseDocumentId('../../etc/passwd')).toThrow()
    expect(() => parseDocumentId('nested/id')).toThrow()
    expect(() => parseDocumentId('back\\slash')).toThrow()
    expect(() => parseDocumentId('..')).toThrow()
    expect(() => parseDocumentId('.')).toThrow()
  })

  it('refuses an empty id', () => {
    expect(() => parseDocumentId('')).toThrow()
    expect(() => parseDocumentId('   ')).toThrow()
  })
})

describe('parseDocumentKind', () => {
  it('accepts a declared kind', () => {
    expect(parseDocumentKind('scene')).toBe('scene')
  })

  it('refuses a kind no editor answers for', () => {
    expect(() => parseDocumentKind('texture')).toThrow()
    expect(() => parseDocumentKind(null)).toThrow()
  })
})

describe('parseDocumentFile', () => {
  it('accepts a well-formed file', () => {
    expect(parseDocumentFile(valid)).toEqual(valid)
  })

  it('keeps the content whole, whatever shape it has', () => {
    const content = { layers: [1, 2], nested: { deep: true } }
    expect(parseDocumentFile({ ...valid, content }).content).toEqual(content)
  })

  // `JSON.stringify` drops a key whose value is `undefined`, so a document an editor
  // serialized to nothing reaches the disk with no `content` at all. Refusing it here would
  // make that document unreadable for good.
  it('accepts a file whose content key never made it to disk', () => {
    const withoutContent = { ...valid, content: undefined }
    delete withoutContent.content
    expect(parseDocumentFile(withoutContent)).toEqual({ ...withoutContent, content: undefined })
  })

  it('gives the content key back, so no caller has to tell absent from empty', () => {
    const withoutContent = { ...valid, content: undefined }
    delete withoutContent.content
    expect('content' in parseDocumentFile(withoutContent)).toBe(true)
  })

  // A project folder is user territory: hand-edited, truncated, or written by an older build.
  it('refuses a file missing what every reader needs', () => {
    expect(() => parseDocumentFile({ ...valid, version: undefined })).toThrow()
    expect(() => parseDocumentFile({ ...valid, kind: 'nonsense' })).toThrow()
    expect(() => parseDocumentFile({ ...valid, updatedAt: '' })).toThrow()
    expect(() => parseDocumentFile(null)).toThrow()
    expect(() => parseDocumentFile('a string')).toThrow()
  })

  it('refuses a version outside the range this build understands', () => {
    expect(() => parseDocumentFile({ ...valid, version: 0 })).toThrow()
    expect(() => parseDocumentFile({ ...valid, version: 1.5 })).toThrow()
    // A file from a later build is refused, not read as if it were this one and then
    // flattened by the next save.
    expect(() => parseDocumentFile({ ...valid, version: DOCUMENT_VERSION + 1 })).toThrow()
  })
})

describe('parseDocumentDraft', () => {
  it('keeps what the editor owns', () => {
    expect(parseDocumentDraft({ title: 'Stone', content: { tiling: 2 } })).toEqual({
      title: 'Stone',
      content: { tiling: 2 },
    })
  })

  // The renderer owns none of these three: the file layer stamps them.
  it('drops an envelope the renderer tried to dictate', () => {
    const drafted = parseDocumentDraft({
      title: 'Stone',
      content: null,
      version: 99,
      kind: 'image',
      updatedAt: 'whenever',
    })

    expect(drafted).toEqual({ title: 'Stone', content: null })
  })

  it('refuses a draft with no title', () => {
    expect(() => parseDocumentDraft({ content: null })).toThrow()
    expect(() => parseDocumentDraft(null)).toThrow()
  })
})
