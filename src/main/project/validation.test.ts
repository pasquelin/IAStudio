import { describe, expect, it } from 'vitest'
import { DOCUMENT_VERSION } from '@shared/domain/document'
import {
  parseAssetQuery,
  parseDocumentDraft,
  parseDocumentEnvelope,
  parseDocumentId,
  parseDocumentKind,
} from './validation'

const valid = {
  version: DOCUMENT_VERSION,
  kind: 'scene',
  title: 'Untitled',
  updatedAt: '2026-08-07T10:00:00.000Z',
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
    expect(() => parseDocumentKind('material')).toThrow()
    expect(() => parseDocumentKind(null)).toThrow()
  })
})

describe('parseDocumentEnvelope', () => {
  it('accepts a well-formed envelope', () => {
    expect(parseDocumentEnvelope(valid)).toEqual(valid)
  })

  // The content lives on the lines under the envelope and never reaches this schema: what a
  // kind stores is its editor's business, and parsing it here would put every editor's format
  // on the thread that owns every window.
  it('drops whatever a hand edit put beside the envelope', () => {
    expect(parseDocumentEnvelope({ ...valid, content: { nodes: [] } })).toEqual(valid)
  })

  // A project folder is user territory: hand-edited, truncated, or written by an older build.
  it('refuses a file missing what every reader needs', () => {
    expect(() => parseDocumentEnvelope({ ...valid, version: undefined })).toThrow()
    expect(() => parseDocumentEnvelope({ ...valid, kind: 'nonsense' })).toThrow()
    expect(() => parseDocumentEnvelope({ ...valid, updatedAt: '' })).toThrow()
    expect(() => parseDocumentEnvelope(null)).toThrow()
    expect(() => parseDocumentEnvelope('a string')).toThrow()
  })

  it('refuses a version outside the range this build understands', () => {
    expect(() => parseDocumentEnvelope({ ...valid, version: 0 })).toThrow()
    expect(() => parseDocumentEnvelope({ ...valid, version: 1.5 })).toThrow()
    // A file from a later build is refused, not read as if it were this one and then
    // flattened by the next save.
    expect(() => parseDocumentEnvelope({ ...valid, version: DOCUMENT_VERSION + 1 })).toThrow()
  })
})

describe('parseDocumentDraft', () => {
  it('keeps what the editor owns, serialized as it arrived', () => {
    expect(parseDocumentDraft({ title: 'Stone', content: '{"tiling":2}' })).toEqual({
      title: 'Stone',
      content: '{"tiling":2}',
    })
  })

  // The editor serializes; the file layer writes. A draft that arrives as anything else has
  // been built by hand, and writing it would put an object where a document goes.
  it('refuses a content that was never serialized', () => {
    expect(() => parseDocumentDraft({ title: 'Stone', content: { tiling: 2 } })).toThrow()
    expect(() => parseDocumentDraft({ title: 'Stone' })).toThrow()
  })

  // The renderer owns none of these three: the file layer stamps them.
  it('drops an envelope the renderer tried to dictate', () => {
    const drafted = parseDocumentDraft({
      title: 'Stone',
      content: '{}',
      version: 99,
      kind: 'image',
      updatedAt: 'whenever',
    })

    expect(drafted).toEqual({ title: 'Stone', content: '{}' })
  })

  it('refuses a draft with no title', () => {
    expect(() => parseDocumentDraft({ content: null })).toThrow()
    expect(() => parseDocumentDraft(null)).toThrow()
  })
})

describe('parseAssetQuery', () => {
  it('lets a workspace ask for the kinds it uses', () => {
    expect(parseAssetQuery({ types: ['image', 'texture', 'skybox'] })).toEqual({
      types: ['image', 'texture', 'skybox'],
    })
  })

  it('refuses a kind the studio does not have', () => {
    expect(() => parseAssetQuery({ types: ['hologram'] })).toThrow()
    expect(() => parseAssetQuery({ type: 'hologram' })).toThrow()
  })

  it('refuses a list longer than there are kinds', () => {
    // A caller asking for eight of six kinds has lost track of what it wants.
    const tooMany = Array.from({ length: 8 }, () => 'image')
    expect(() => parseAssetQuery({ types: tooMany })).toThrow()
  })

  it('narrows by where the bytes are, and by nothing else that looks like it', () => {
    expect(parseAssetQuery({ location: 'cloud' })).toEqual({ location: 'cloud' })
    expect(() => parseAssetQuery({ location: 'remote' })).toThrow()
  })

  it('accepts a sync state the catalogue can hold, and refuses the rest', () => {
    expect(parseAssetQuery({ syncStatus: 'local-ahead' })).toEqual({ syncStatus: 'local-ahead' })
    expect(() => parseAssetQuery({ syncStatus: 'pushing' })).toThrow()
  })

  it('refuses a group that names nothing', () => {
    expect(parseAssetQuery({ groupId: 'job_1' })).toEqual({ groupId: 'job_1' })
    expect(() => parseAssetQuery({ groupId: '   ' })).toThrow()
  })

  it('asks for everything when asked for nothing', () => {
    expect(parseAssetQuery({})).toEqual({})
  })
})
