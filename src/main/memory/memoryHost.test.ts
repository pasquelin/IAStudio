import { describe, expect, it, vi } from 'vitest'
import type { AsyncMemory } from './memoryClient'
import { createMemoryHost, type MemoryHost } from './memoryHost'

const fakeMemory = (): AsyncMemory => ({
  remember: vi.fn(),
  amend: vi.fn(),
  forget: vi.fn(),
  read: vi.fn(),
  list: vi.fn(),
  markUsed: vi.fn(),
  rebuild: vi.fn(),
  refresh: vi.fn(),
  reset: vi.fn(),
  trouble: vi.fn(),
  close: vi.fn(async () => {}),
})

function hostOn(open = vi.fn(async () => fakeMemory())): {
  host: MemoryHost
  open: typeof open
  troubles: string[]
} {
  const troubles: string[] = []
  return {
    host: createMemoryHost({ userData: '/machine', open, onTrouble: why => troubles.push(why) }),
    open,
    troubles,
  }
}

describe('which memory answers', () => {
  it('has none until a project is open', async () => {
    const { host, open } = hostOn()

    expect(await host.project()).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })

  /** 🛑 CLAUDE.md's performance rule: opening a project must not pay for a thread nobody asked. */
  it('opens nothing merely because a project was opened', async () => {
    const { host, open } = hostOn()
    host.follow('/projects/film')

    expect(open).not.toHaveBeenCalled()
  })

  it('opens the file and the index of the project that is open', async () => {
    const { host, open } = hostOn()
    host.follow('/projects/film')
    await host.project()

    expect(open).toHaveBeenCalledWith(
      '/projects/film/.ia-studio/memory.ndjson',
      '/projects/film/.index/memory.db',
    )
  })

  /** 🛑 Two writers on one SQLite file is the defect: two turns asking at once open ONE thread. */
  it('opens one thread however many callers ask at once', async () => {
    const { host, open } = hostOn()
    host.follow('/projects/film')
    await Promise.all([host.project(), host.project(), host.project()])

    expect(open).toHaveBeenCalledTimes(1)
  })

  it('opens the machine memory beside a project, and only once', async () => {
    const { host, open } = hostOn()
    await Promise.all([host.global(), host.global()])

    expect(open).toHaveBeenCalledExactlyOnceWith('/machine/memory.ndjson', '/machine/memory.db')
  })
})

describe('changing project', () => {
  it('lets go of the one it held and opens the next on demand', async () => {
    const held = fakeMemory()
    const { host, open } = hostOn(vi.fn(async () => held))
    host.follow('/projects/one')
    await host.project()

    host.follow('/projects/two')
    await host.project()

    expect(held.close).toHaveBeenCalled()
    expect(open).toHaveBeenLastCalledWith(
      '/projects/two/.ia-studio/memory.ndjson',
      '/projects/two/.index/memory.db',
    )
  })

  it('does nothing at all when the same project is published again', async () => {
    const { host, open } = hostOn()
    host.follow('/projects/one')
    await host.project()
    host.follow('/projects/one')
    await host.project()

    expect(open).toHaveBeenCalledTimes(1)
  })

  it('answers nothing again once no project is open', async () => {
    const { host } = hostOn()
    host.follow('/projects/one')
    await host.project()
    host.follow(null)

    expect(await host.project()).toBeNull()
  })
})

describe('when a memory will not open', () => {
  /** 🛑 The studio has worked without a memory until now, and goes on doing so. */
  it('costs the memory and never the project', async () => {
    const { host, troubles } = hostOn(
      vi.fn(async () => {
        throw new Error('the database is locked')
      }),
    )
    host.follow('/projects/film')

    expect(await host.project()).toBeNull()
    expect(troubles).toEqual(['the database is locked'])
  })
})
