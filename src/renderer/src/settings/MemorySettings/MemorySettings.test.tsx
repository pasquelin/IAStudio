import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Memory, MemoryPatch, MemoryQuery, MemoryScope } from '@shared/domain/assistantMemory'
import { useAssistantMemory } from '@/stores/assistantMemory'
import { MemorySettings } from './MemorySettings'

const memory = (fields: Partial<Memory> = {}): Memory => ({
  id: 'm_one',
  type: 'decision',
  summary: 'Les caméras suivent le rail',
  body: 'décidé au troisième montage',
  importance: 4,
  createdAt: '2026-08-28T10:00:00.000Z',
  source: { kind: 'action', ref: 'script.write' },
  refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }],
  links: [],
  state: 'live',
  ...fields,
})

const asked: { scope: MemoryScope; query: MemoryQuery }[] = []
const amended: { id: string; patch: MemoryPatch }[] = []
const forgotten: string[] = []

function standing(memories: readonly Memory[] = [memory()], over: Partial<MemoryQuery> = {}): void {
  asked.length = 0
  amended.length = 0
  forgotten.length = 0
  useAssistantMemory.setState({
    memories,
    scope: 'project',
    query: over,
    loaded: true,
    pending: 0,
    indexing: null,
    look: async (scope, query) => {
      asked.push({ scope, query })
      useAssistantMemory.setState({ scope, query, memories, loaded: true })
    },
    amend: async (id, patch) => {
      amended.push({ id, patch })
      return true
    },
    forget: async id => {
      forgotten.push(id)
      return true
    },
    rebuild: async () => memories.length,
    reset: async () => {},
    index: async () => {},
    stopIndex: async () => {},
  })
}

beforeEach(() => standing())

describe('what the assistant knows', () => {
  // What a row OPENS onto is `MemoryRowDetail`'s own test: the collection virtualises its rows,
  // and jsdom measures every one of them at zero.
  it('lists what it has learned, with what each one is about', async () => {
    render(<MemorySettings />)

    expect(await screen.findByText('Les caméras suivent le rail')).toBeVisible()
    // The row, not the filter's option: both spell the same word.
    expect(screen.getAllByText('Décision').some(one => one.tagName === 'SPAN')).toBe(true)
  })

  /**
   * 🛑 The performance rule of the whole chantier: the memory thread opens lazily, and a panel
   * that asked on mount would have opening a project pay for a database nobody questioned. The
   * panel is only mounted when its section is opened, which is what makes this the right place.
   */
  it('asks for a listing only once the panel is on screen', () => {
    render(<MemorySettings />)

    expect(asked).toHaveLength(1)
    expect(asked[0]?.scope).toBe('project')
  })

  it('asks the other memory when the other chip is picked', async () => {
    render(<MemorySettings />)
    await userEvent.click(screen.getByRole('button', { name: 'Cette machine' }))

    await waitFor(() => expect(asked.at(-1)?.scope).toBe('global'))
  })

  it('carries what was typed and what was filtered into the same question', async () => {
    render(<MemorySettings />)
    await userEvent.type(screen.getByRole('searchbox'), 'rail')

    await waitFor(() => expect(asked.at(-1)?.query.text).toBe('rail'))
  })
})

describe('correcting what it knows', () => {
  it('pins a memory, and offers to unpin it once it is', async () => {
    render(<MemorySettings />)
    await userEvent.click(screen.getByRole('button', { name: 'Épingler' }))

    expect(amended).toEqual([{ id: 'm_one', patch: { state: 'pinned' } }])
  })

  it('offers to put an archived memory back to use', () => {
    standing([memory({ state: 'archived' })])
    render(<MemorySettings />)

    expect(screen.getByRole('button', { name: 'Remettre en service' })).toBeVisible()
  })

  it('forgets one', async () => {
    render(<MemorySettings />)
    await userEvent.click(screen.getByRole('button', { name: 'Oublier' }))

    expect(forgotten).toEqual(['m_one'])
  })

  /** 🛑 This one erases the file, and no Cancel covers it. */
  it('asks before erasing everything, and does nothing when the answer is no', async () => {
    const asking = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const reset = vi.fn(async () => {})
    useAssistantMemory.setState({ reset })
    render(<MemorySettings />)

    await userEvent.click(screen.getByRole('button', { name: 'Tout oublier' }))

    expect(asking).toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
    asking.mockRestore()
  })
})

describe('the vectors', () => {
  it('says how many are waiting, and offers to compute them', () => {
    standing()
    useAssistantMemory.setState({ pending: 3 })
    render(<MemorySettings />)

    expect(screen.getByText('3 mémoires à calculer')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Calculer les vecteurs' })).toBeEnabled()
  })

  it('offers to stop a run in flight rather than start a second', () => {
    standing()
    useAssistantMemory.setState({ indexing: { scope: 'project', done: 1, total: 4 }, pending: 3 })
    render(<MemorySettings />)

    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Calculer les vecteurs' })).toBeNull()
  })

  it('says nothing is waiting when every memory has its vector', () => {
    render(<MemorySettings />)

    expect(screen.getByText('Toutes les mémoires ont leur vecteur.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Calculer les vecteurs' })).toBeDisabled()
  })
})
