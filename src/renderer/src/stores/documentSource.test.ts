import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentFile } from '@shared/domain/document'
import { installFakeBridge } from '@/services/fakeBridge'
import { createDocumentSource } from './documentSource'

type Held = { title: string; picture: string | null }

/** What the file holds for this read — a decor changes it to answer differently the second time. */
let answers = '{"title":"un","picture":"asset-1"}'
let reads = 0

const fileOf = (content: string): DocumentFile => ({
  id: 'doc-1',
  kind: 'material',
  version: 1,
  title: 'Doc',
  updatedAt: '2026-08-26T10:00:00.000Z',
  content,
})

describe('the copies of a document another one names', () => {
  beforeEach(() => {
    reads = 0
    answers = '{"title":"un","picture":"asset-1"}'
    installFakeBridge({
      documents: {
        read: () => {
          reads += 1
          return Promise.resolve(fileOf(answers))
        },
      },
    })
  })

  const sourceOf = (options: { whole?: (state: Held, payload: unknown) => boolean } = {}) =>
    createDocumentSource<Held, number>({
      kind: 'material',
      parse: payload => payload as Held,
      ...options,
    })

  /**
   * `DocumentFile.content` is the SERIALIZED text: a reader handed the string finds nothing in it,
   * and answers an empty document rather than failing. The defect this family was hit by twice.
   */
  it('hands the reader the PAYLOAD, never the text of the file', async () => {
    const source = sourceOf()

    await source.load('doc-1')

    expect(source.copyOf('doc-1')).toEqual({ title: 'un', picture: 'asset-1' })
  })

  it('reads the file once, however many callers ask', async () => {
    const source = sourceOf()

    await source.load('doc-1')
    await source.load('doc-1')

    expect(reads).toBe(1)
  })

  // Parsed ONCE and handed to both, or a `.mtlx` of a hundred channels is parsed twice per read.
  it('parses the file once for the reader and for the completeness question', async () => {
    const seen: unknown[] = []
    const source = sourceOf({
      whole: (_, payload) => {
        seen.push(payload)
        return true
      },
    })

    await source.load('doc-1')

    expect(seen).toEqual([{ title: 'un', picture: 'asset-1' }])
  })

  it('reads the file again once a tab has handed the document back', async () => {
    const source = sourceOf()
    await source.load('doc-1')

    source.forget('doc-1')
    await source.load('doc-1')

    expect(reads).toBe(2)
  })

  /**
   * A read that found nothing to resolve came too early, and a once-only read would keep that
   * emptiness for the session — see `PATH_RESOLVERS`.
   */
  it('drops a copy that came too early, and keeps one that resolved', async () => {
    let shelf = 0
    const source = createDocumentSource<Held, number>({
      kind: 'material',
      parse: payload => payload as Held,
      whole: state => state.picture !== null,
      against: () => shelf,
      landed: against => against === 0 && shelf > 0,
    })

    answers = '{"title":"un","picture":null}'
    await source.load('doc-1')
    expect(source.copyOf('doc-1')).not.toBeNull()

    shelf = 1
    expect(source.copyOf('doc-1')).toBeNull()

    answers = '{"title":"un","picture":"asset-1"}'
    await source.load('doc-1')
    const whole = source.copyOf('doc-1')

    shelf = 2
    expect(source.copyOf('doc-1')).toBe(whole)
  })

  /** Nothing else waits for a read to land, so a viewport is told rather than asked. */
  it('says which documents a read has just landed for', async () => {
    const source = sourceOf()
    const landed = vi.fn()
    source.subscribe(landed)

    await source.load('doc-1')

    expect(landed).toHaveBeenCalledWith(['doc-1'])
  })

  it('files a failure and lets the next ask read again', async () => {
    const source = sourceOf()
    installFakeBridge({ documents: { read: () => Promise.reject(new Error('mid-rewrite')) } })

    await source.load('doc-1')

    expect(source.copyOf('doc-1')).toBeNull()
    installFakeBridge({ documents: { read: () => Promise.resolve(fileOf(answers)) } })
    await source.load('doc-1')
    expect(source.copyOf('doc-1')).not.toBeNull()
  })
})
