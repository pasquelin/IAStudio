import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Us } from '@shared/domain/time'
import type { TimelineEngineDeps } from '@/engines/timeline/TimelineEngine'
import { sequenceWith } from '@/engines/timeline/timeline-fixtures'
import type { SequenceState } from '@/engines/timeline/timelineState'
import { installFakeBridge } from '@/services/fakeBridge'
import { useScenes } from '@/stores/scenes'
import { Monitor } from './Monitor'

/**
 * jsdom has neither WebGL nor WebCodecs, so the engine is a stub that hands its deps back. What
 * this covers is the one thing the component owes the engine: showing what it reports.
 */
const built: TimelineEngineDeps[] = []
const engines: { seek: ReturnType<typeof vi.fn> }[] = []

vi.mock('@/engines/timeline/TimelineEngine', () => ({
  TimelineEngine: class {
    constructor(deps: TimelineEngineDeps) {
      built.push(deps)
      engines.push(this)
    }
    mount = vi.fn(() => Promise.resolve())
    apply = vi.fn()
    seek = vi.fn(() => Promise.resolve())
    play = vi.fn()
    pause = vi.fn()
    playing = vi.fn(() => false)
    dispose = vi.fn()
  },
}))

const report = (unreadable: boolean): void => {
  act(() => built.at(-1)?.onUnreadable?.(unreadable))
}

const onTime = vi.fn()

const at = (playhead: Us): SequenceState => ({ ...sequenceWith([]), playhead })

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
        role="Le montage entier, tel qu’il sera exporté"
        sequence={sequenceWith([])}
        onTime={onTime}
        placeholder={placeholder ? <p>{placeholder}</p> : undefined}
        program
      />,
    )

  it('stays silent while every clip decodes', () => {
    mounted()

    expect(screen.queryByText(/n’a pas pu être affiché/)).not.toBeInTheDocument()
  })

  /**
   * A scene edited in its own tab changes no sequence, so the redraw runs off a ref rather than a
   * dependency — and it has to be the head the monitor stands on NOW, not the one it mounted with.
   */
  it('redraws a scene edit at the head it currently stands on', () => {
    const view = render(
      <Monitor owner="doc-1:program" title="Programme" role="r" sequence={at(0)} onTime={onTime} />,
    )
    view.rerender(
      <Monitor
        owner="doc-1:program"
        title="Programme"
        role="r"
        sequence={at(4_000_000)}
        onTime={onTime}
      />,
    )

    act(() => useScenes.setState(state => ({ ...state })))

    expect(engines.at(-1)?.seek).toHaveBeenCalledWith(4_000_000)
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

  /**
   * Two monitors showing the same black rectangle is what this space cannot explain by itself,
   * and the answer stays under the transport once both are showing something — an empty state
   * would take it away exactly when the pair is hardest to tell apart.
   */
  it('says what it shows, whether or not there is a picture in it', () => {
    mounted()

    expect(screen.getByText(/Le montage entier/)).toBeInTheDocument()
  })

  /**
   * A window and not this element blown up, and the measurement is why: asked on the picture,
   * `requestFullscreen()` neither resolved nor rejected in this Electron window — nothing came
   * back from the platform, so there was not even a refusal to report.
   */
  describe('the video return', () => {
    it('asks the main process for the window, which is the one thing it cannot open itself', async () => {
      const open = vi.fn(() => Promise.resolve())
      installFakeBridge({ mirror: { open } })
      mounted()

      await userEvent.click(screen.getByRole('button', { name: /Fenêtre de retour/ }))

      expect(open).toHaveBeenCalledTimes(1)
    })

    /**
     * The source shows the take being trimmed; a return on it would be the first monitor's
     * picture on the second screen. `keyboard` marks the program, and marks it once per tab.
     */
    it('is offered by the program monitor alone', () => {
      render(
        <Monitor
          owner="doc-1:source"
          title="Source"
          role="Le clip choisi"
          sequence={sequenceWith([])}
          onTime={onTime}
        />,
      )

      expect(screen.queryByRole('button', { name: /Fenêtre de retour/ })).not.toBeInTheDocument()
    })
  })
})
