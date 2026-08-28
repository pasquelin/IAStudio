import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Memory } from '@shared/domain/assistantMemory'
import { MemoryRowDetail } from './MemoryRowDetail'

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

describe('where a memory came from', () => {
  /**
   * 🛑 What makes a memory answerable for: nothing here is computed for the screen. The person
   * can see what wrote it, when, what it points at and what it replaced — and correct any of it.
   */
  it('names the action that wrote it, and what it points at', () => {
    render(<MemoryRowDetail memory={memory()} />)

    expect(screen.getByText(/script\.write/)).toBeVisible()
    expect(screen.getByText('Scripts/Cam.ts')).toBeVisible()
    expect(screen.getByText('décidé au troisième montage')).toBeVisible()
  })

  it('says when the person wrote it themselves', () => {
    render(<MemoryRowDetail memory={memory({ source: { kind: 'person' } })} />)

    expect(screen.getByText(/vous/)).toBeVisible()
  })

  it('names what it replaced, and says nothing when it replaced nothing', () => {
    const { unmount } = render(<MemoryRowDetail memory={memory({ supersedes: 'm_old' })} />)
    expect(screen.getByText(/m_old/)).toBeVisible()
    unmount()

    render(<MemoryRowDetail memory={memory()} />)
    expect(screen.queryByText(/Remplace/)).toBeNull()
  })

  it('lists what it links to', () => {
    render(<MemoryRowDetail memory={memory({ links: ['m_two'] })} />)

    expect(screen.getByText('m_two')).toBeVisible()
  })
})
