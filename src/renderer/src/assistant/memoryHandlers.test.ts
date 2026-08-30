import { describe, expect, it, vi } from 'vitest'
import type { Memory } from '@shared/domain/assistantMemory'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDocuments } from '@/stores/documents'
import { MEMORY_HANDLERS } from './memoryHandlers'

const memory = (fields: Partial<Memory> = {}): Memory => ({
  id: 'm_a',
  type: 'decision',
  summary: 'Cameras follow the rail, never the target.',
  body: '',
  importance: 4,
  createdAt: '2026-08-28T10:00:00.000Z',
  source: { kind: 'assistant' },
  refs: [],
  links: [],
  state: 'live',
  ...fields,
})

const run = (name: keyof typeof MEMORY_HANDLERS, input = {}) => MEMORY_HANDLERS[name]?.(input)

describe('what a client reaches the memory by', () => {
  /**
   * 🛑 The one thing this handler must not do, and nothing else would catch it: `list` FILTERS —
   * FTS5 in `AND` demanded all thirteen words of « à quoi sert le script CameraRig ? » of a single
   * memory. Both calls take `{text, limit}`, so the wrong one compiles and passes every gate.
   */
  it('asks a question rather than laying down a filter', async () => {
    const recall = vi.fn(() => Promise.resolve([memory()]))
    const list = vi.fn(() => Promise.resolve([]))
    installFakeBridge({ memory: { recall, list } })

    await run('memory.recall', { query: 'à quoi sert le script CameraRig ?' })

    expect(recall).toHaveBeenCalledWith('project', {
      text: 'à quoi sert le script CameraRig ?',
      refs: [],
      limit: 10,
    })
    expect(list).not.toHaveBeenCalled()
  })

  /**
   * 🛑 `anchored` is the strongest voice of the ranking — weight 1, « it is not a guess » — and
   * nothing else in the studio fills it: a recall that did not carry what is in front scored on
   * words and meaning alone, and the weight never answered once in production.
   */
  it('anchors the question on the document in front', async () => {
    const recall = vi.fn(() => Promise.resolve([]))
    installFakeBridge({ memory: { recall } })
    useDocuments.setState({
      activeId: 'd_1',
      documents: { d_1: { id: 'd_1', path: 'Scripts/CameraRig.ts' } as never },
    })

    await run('memory.recall', { query: 'the rail' })

    expect(recall).toHaveBeenCalledWith('project', {
      text: 'the rail',
      refs: [
        { kind: 'file', ref: 'Scripts/CameraRig.ts' },
        { kind: 'document', ref: 'd_1' },
      ],
      limit: 10,
    })
  })

  it('carries no anchor on a home screen', async () => {
    const recall = vi.fn(() => Promise.resolve([]))
    installFakeBridge({ memory: { recall } })
    useDocuments.setState({ activeId: null, documents: {} })

    await run('memory.recall', { query: 'the rail' })

    expect(recall).toHaveBeenCalledWith('project', { text: 'the rail', refs: [], limit: 10 })
  })

  /**
   * Enough to be useful in ONE round trip, which is what the memory being a resource the model
   * goes and asks — rather than a block pushed at it — requires.
   */
  it('answers what decides whether the body is worth a second call', async () => {
    installFakeBridge({
      memory: { recall: () => Promise.resolve([memory({ body: 'The rail was chosen because…' })]) },
    })

    expect(await run('memory.recall', { query: 'the rail' })).toEqual({
      ok: true,
      data: {
        memories: [
          {
            id: 'm_a',
            type: 'decision',
            summary: 'Cameras follow the rail, never the target.',
            importance: 4,
            hasBody: true,
          },
        ],
      },
    })
  })

  it('answers an empty recall for a studio with no project open', async () => {
    installFakeBridge({ memory: { recall: () => Promise.resolve([]) } })

    expect(await run('memory.recall', { query: 'the rail' })).toEqual({
      ok: true,
      data: { memories: [] },
    })
  })

  it('refuses a recall with no question in it', async () => {
    expect(await run('memory.recall', {})).toMatchObject({ ok: false, refusal: 'badInput' })
  })
})
