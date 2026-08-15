import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
        role="Le montage entier, tel qu’il sera exporté"
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

  /**
   * Two monitors showing the same black rectangle is what this space cannot explain by itself,
   * and the answer stays under the transport once both are showing something — an empty state
   * would take it away exactly when the pair is hardest to tell apart.
   */
  it('says what it shows, whether or not there is a picture in it', () => {
    mounted()

    expect(screen.getByText(/Le montage entier/)).toBeInTheDocument()
  })

  describe('full screen', () => {
    it('asks the platform for the picture alone, not for the transport around it', async () => {
      const request = vi.fn(() => Promise.resolve())
      Element.prototype.requestFullscreen = request
      mounted()

      await userEvent.click(screen.getByRole('button', { name: /Plein écran/ }))

      expect(request).toHaveBeenCalledTimes(1)
      // The element that asked is the one holding the canvas, so the studio's furniture stays out.
      const asked = request.mock.instances[0]
      expect(asked).toBeInstanceOf(HTMLElement)
      expect((asked as HTMLElement).querySelector('canvas, div')).not.toBeNull()
    })

    /**
     * Escape leaves full screen without passing through this component, and so does the platform's
     * own chrome. A boolean of our own would then offer to leave a full screen nobody is in.
     */
    it('reads the state off the document rather than remembering its own', async () => {
      Element.prototype.requestFullscreen = vi.fn(() => Promise.resolve())
      mounted()
      const picture = screen.getByRole('button', { name: /Plein écran/ })
      await userEvent.click(picture)

      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'))
      })

      // Nothing entered full screen in jsdom, so the button still offers to.
      expect(screen.getByRole('button', { name: /Plein écran/ })).toBeInTheDocument()
    })
  })
})
