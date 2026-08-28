import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Memory, MemoryScope } from '@shared/domain/assistantMemory'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssistantMemory } from './assistantMemory'

const memory = (fields: Partial<Memory> = {}): Memory => ({
  id: 'm_one',
  type: 'decision',
  summary: 'Cameras follow the rail',
  body: '',
  importance: 3,
  createdAt: '2026-08-28T10:00:00.000Z',
  source: { kind: 'person' },
  refs: [],
  links: [],
  state: 'live',
  ...fields,
})

const state = () => useAssistantMemory.getState()

beforeEach(() => {
  useAssistantMemory.setState({ memories: [], scope: 'project', query: {}, loaded: false })
})

describe('what the window holds', () => {
  it('says nothing is held only once it has asked', async () => {
    installFakeBridge({ memory: { list: () => Promise.resolve([memory()]) } })

    expect(state().loaded).toBe(false)
    await state().reload()
    expect(state().loaded).toBe(true)
    expect(state().memories).toEqual([memory()])
  })

  it('asks for the scope and the query it was last given', async () => {
    const list = vi.fn(() => Promise.resolve([]))
    installFakeBridge({ memory: { list } })

    await state().look('global', { text: 'rail', limit: 5 })

    expect(list).toHaveBeenCalledWith('global', { text: 'rail', limit: 5 })
  })

  /** 🛑 A memory the assistant wrote in another window belongs on screen in this one too. */
  it('follows what another window writes into the same scope', async () => {
    const announcers: ((scope: MemoryScope) => void)[] = []
    const list = vi.fn(() => Promise.resolve([memory()]))
    installFakeBridge({
      memory: {
        list,
        onChanged: callback => {
          announcers.push(callback)
          return () => {}
        },
      },
    })

    await state().connect()
    list.mockClear()
    for (const announce of announcers) announce('project')
    await vi.waitFor(() => expect(list).toHaveBeenCalled())
  })

  it('ignores a write into the scope it is not showing', async () => {
    const announcers: ((scope: MemoryScope) => void)[] = []
    const list = vi.fn(() => Promise.resolve([]))
    installFakeBridge({
      memory: {
        list,
        onChanged: callback => {
          announcers.push(callback)
          return () => {}
        },
      },
    })

    await state().connect()
    list.mockClear()
    for (const announce of announcers) announce('global')

    expect(list).not.toHaveBeenCalled()
  })
})

describe('writing from the window', () => {
  it('writes into the scope on screen', async () => {
    const remember = vi.fn(() => Promise.resolve(memory()))
    installFakeBridge({ memory: { remember } })
    await state().look('global', {})

    await state().remember({
      type: 'decision',
      summary: 'x',
      importance: 3,
      source: { kind: 'person' },
    })

    expect(remember).toHaveBeenCalledWith('global', expect.objectContaining({ summary: 'x' }))
  })

  /** Nothing to draw before the answer: the id and the date are the main process's to mint. */
  it('answers nothing when no project is open to remember into', async () => {
    installFakeBridge({ memory: { remember: () => Promise.resolve(null) } })

    expect(
      await state().remember({
        type: 'decision',
        summary: 'x',
        importance: 3,
        source: { kind: 'person' },
      }),
    ).toBeNull()
  })

  it('says whether a memory it tried to change was there at all', async () => {
    installFakeBridge({ memory: { amend: () => Promise.resolve(null) } })

    expect(await state().amend('m_gone', { summary: 'x' })).toBe(false)
  })
})
