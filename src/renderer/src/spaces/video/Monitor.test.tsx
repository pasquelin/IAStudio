import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TimelineEngineDeps } from '@/engines/timeline/TimelineEngine'
import { sequenceWith } from '@/engines/timeline/timeline-fixtures'
import { Monitor } from './Monitor'

/**
 * jsdom has neither WebGL nor WebCodecs, so the engine is a stub that hands its deps back. What
 * this covers is the one thing the component owes the engine: showing what it reports.
 */
const built: TimelineEngineDeps[] = []

vi.mock('@/engines/timeline/TimelineEngine', () => ({
  TimelineEngine: class {
    constructor(deps: TimelineEngineDeps) {
      built.push(deps)
    }
    mount = vi.fn(() => Promise.resolve())
    apply = vi.fn()
    seek = vi.fn(() => Promise.resolve())
    play = vi.fn()
    pause = vi.fn()
    playing = vi.fn(() => false)
    openSinks = vi.fn(() => 0)
    dispose = vi.fn()
  },
}))

const report = (unreadable: boolean): void => {
  act(() => built.at(-1)?.onUnreadable?.(unreadable))
}

const onTime = vi.fn()

describe('Monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    built.length = 0
  })

  const mounted = (placeholder?: string) =>
    render(
      <Monitor
        owner="doc-1:program"
        title="Programme"
        sequence={sequenceWith([])}
        onTime={onTime}
        placeholder={placeholder ? <p>{placeholder}</p> : undefined}
      />,
    )

  it('stays silent while every clip decodes', () => {
    mounted()

    expect(screen.queryByText(/n’a pas pu être affiché/)).not.toBeInTheDocument()
  })

  /** A `.exr` on a track used to leave the programme black, with nothing on screen saying why. */
  it('says why the picture is black when the engine reports an unreadable clip', () => {
    mounted()

    report(true)

    expect(screen.getByText(/n’a pas pu être affiché/)).toBeInTheDocument()
  })

  it('drops the message once the playhead reaches a clip that decodes', () => {
    mounted()
    report(true)

    report(false)

    expect(screen.queryByText(/n’a pas pu être affiché/)).not.toBeInTheDocument()
  })

  it('prefers the reason to the invitation its host shows over an empty monitor', () => {
    mounted('Sélectionnez un clip pour le voir ici.')

    report(true)

    expect(screen.queryByText(/Sélectionnez un clip/)).not.toBeInTheDocument()
    expect(screen.getByText(/n’a pas pu être affiché/)).toBeInTheDocument()
  })
})
