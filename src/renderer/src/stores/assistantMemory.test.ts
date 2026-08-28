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
  useAssistantMemory.setState({
    memories: [],
    scope: 'project',
    query: {},
    loaded: false,
    asked: false,
  })
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
  it('follows what another window writes into the same scope, once it has read', async () => {
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
    await state().reload()
    list.mockClear()
    for (const announce of announcers) announce('project')
    await vi.waitFor(() => expect(list).toHaveBeenCalled())
  })

  /**
   * 🛑 What « opening pays nothing » means here: the settings window connects this from its root,
   * so a panel nobody opened must not open a thread and a database over someone else's write.
   */
  it('does not read on a write announced before the panel has asked for anything', async () => {
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
    for (const announce of announcers) announce('project')

    expect(list).not.toHaveBeenCalled()
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

describe('what a listing costs', () => {
  /**
   * 🛑 `pending` is a `LEFT JOIN` over EVERY memory of the scope and does not depend on the
   * query, so counting it per listing made each keystroke of the search pay a scan whose answer
   * could not have moved.
   */
  it('counts what is left to embed per scope, not per question typed', async () => {
    const pending = vi.fn(() => Promise.resolve(3))
    installFakeBridge({ memory: { list: () => Promise.resolve([]), pending } })

    await state().look('project', {})
    await state().look('project', { text: 'rail' })
    await state().look('project', { text: 'rails' })

    expect(pending).toHaveBeenCalledTimes(1)

    await state().look('global', {})
    expect(pending).toHaveBeenCalledTimes(2)
  })

  /**
   * 🛑 The main process announces a change per amendment and this window hears its OWN: a merge
   * set off a full listing per amendment, in every open window, for a result one final read
   * describes.
   */
  it('reads once at the end of a burst, not once per memory it amended', async () => {
    const announcers: ((scope: MemoryScope) => void)[] = []
    const twins = [memory({ id: 'm_a' }), memory({ id: 'm_b' }), memory({ id: 'm_c' })]
    const list = vi.fn(() => Promise.resolve(twins))
    installFakeBridge({
      memory: {
        list,
        // What the main process does on every amendment — see `handlers.ts`.
        amend: (_scope: MemoryScope, id: string) => {
          for (const announce of announcers) announce('project')
          return Promise.resolve(twins.find(one => one.id === id) ?? null)
        },
        onChanged: callback => {
          announcers.push(callback)
          return () => {}
        },
      },
    })

    await state().connect()
    await state().reload()
    list.mockClear()

    expect(await state().mergeDuplicates()).toBe(2)
    expect(list).toHaveBeenCalledTimes(1)
  })
})

describe('the bar that says something is happening', () => {
  /**
   * 🛑 An aborted run leaves `sweep`'s loop without a last `onProgress`, so nothing ever says it
   * ended: the panel kept offering Stop for the rest of the session, with Embed unreachable
   * behind it, and pressing Stop again aborted a controller nobody was watching.
   */
  it('takes the bar down when the run is stopped, without waiting for an event', async () => {
    installFakeBridge({ memory: { stopIndex: () => Promise.resolve() } })
    useAssistantMemory.setState({ indexing: { scope: 'project', done: 3, total: 40 } })

    await state().stopIndex()

    expect(state().indexing).toBeNull()
  })

  it('takes it down when the panel moves to the other memory', async () => {
    installFakeBridge()
    useAssistantMemory.setState({ indexing: { scope: 'project', done: 3, total: 40 } })

    await state().look('global', {})

    expect(state().indexing).toBeNull()
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

  /**
   * 🛑 The scope is captured ONCE. Moving the pill mid-burst sent the rest of the merge at the
   * other memory — the ids do not exist there, so nothing was written wrongly, but the merge
   * stopped half done and reported a figure that was not true.
   */
  it('merges into the scope the burst started in, whatever the pill does meanwhile', async () => {
    const asked: MemoryScope[] = []
    const twins = [memory({ id: 'm_a' }), memory({ id: 'm_b' }), memory({ id: 'm_c' })]
    installFakeBridge({
      memory: {
        list: () => Promise.resolve(twins),
        amend: (scope: MemoryScope, id: string) => {
          asked.push(scope)
          // What a window does while the burst runs: the panel moves to the machine's memory.
          useAssistantMemory.setState({ scope: 'global' })
          return Promise.resolve(twins.find(one => one.id === id) ?? null)
        },
      },
    })

    await state().reload()

    expect(await state().mergeDuplicates()).toBe(2)
    expect(asked).toEqual(['project', 'project'])
  })
})
