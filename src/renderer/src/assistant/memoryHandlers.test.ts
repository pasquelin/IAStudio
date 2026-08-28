import { describe, expect, it, vi } from 'vitest'
import { MEMORY_BODY_MAX, MEMORY_SUMMARY_MAX, type Memory } from '@shared/domain/assistantMemory'
import { installFakeBridge } from '@/services/fakeBridge'
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
      limit: 10,
    })
    expect(list).not.toHaveBeenCalled()
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
    expect(await run('memory.recall', {})).toEqual({ ok: false, refusal: 'badInput' })
  })

  /**
   * 🛑 `fits` does not enforce `max` on a text field, so an over-long value reached the main
   * process, `parseMemoryDraft` threw, and the client got a catch-all refusal naming no field —
   * which it then retried with the same value.
   */
  it('refuses a summary or a body longer than the store takes, by name', async () => {
    const remember = vi.fn(() => Promise.resolve(memory()))
    installFakeBridge({ memory: { remember } })

    const tooLong = { type: 'decision', summary: 'x'.repeat(MEMORY_SUMMARY_MAX + 1) }
    expect(await run('memory.write', tooLong)).toEqual({ ok: false, refusal: 'badInput' })

    const bigBody = { type: 'decision', summary: 'x', body: 'y'.repeat(MEMORY_BODY_MAX + 1) }
    expect(await run('memory.write', bigBody)).toEqual({ ok: false, refusal: 'badInput' })
    expect(remember).not.toHaveBeenCalled()
  })
})
