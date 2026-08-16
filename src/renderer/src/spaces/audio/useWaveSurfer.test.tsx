import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenderedAudio } from '@/engines/audio/audio-render'
import { refreshPalette } from '@/engines/core/palette'
import { useWaveSurfer } from './useWaveSurfer'

const loadBlob = vi.fn(() => Promise.resolve())
const destroy = vi.fn()
const setOptions = vi.fn((_options: unknown) => {})
const dragSelection = vi.fn((_options: unknown) => {})
const zoom = vi.fn((_pxPerSecond: number) => {})
const duration = vi.fn(() => 2)
const setScroll = vi.fn((_pixels: number) => {})
const create = vi.fn((_options: unknown) => ({
  on: vi.fn(),
  loadBlob,
  destroy,
  setOptions,
  zoom,
  setScroll,
  getScroll: () => 40,
  // A two-second take across a 400 px panel: fitted, it is drawn at 200 pixels a second.
  getDuration: duration,
  getWidth: () => 400,
  isPlaying: () => false,
  play: vi.fn(),
  pause: vi.fn(),
}))

// jsdom draws nothing and decodes nothing: what is worth holding here is WHEN the instance is
// built and handed its take, which is exactly what the surface's arrival time decides.
vi.mock('wavesurfer.js', () => ({ default: { create: (options: unknown) => create(options) } }))

vi.mock('wavesurfer.js/dist/plugins/regions.js', () => ({
  default: {
    create: () => ({
      enableDragSelection: (options: unknown) => dragSelection(options),
      on: vi.fn(),
      getRegions: () => [],
    }),
  },
}))

const rendered: RenderedAudio = {
  data: { sampleRate: 100, channels: [new Float32Array(200).fill(0.5)] },
  wav: new Uint8Array(8),
  shape: { inPoint: 0, duration: 2_000_000, fadeIn: 0, fadeOut: 0, gain: 0 },
  silence: { head: 0, tail: 2_000_000 },
}

function Editor({
  surface,
  nodeKey = 'one',
  rendered: take = rendered,
}: {
  surface: boolean
  nodeKey?: string
  rendered?: RenderedAudio
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  useWaveSurfer({ container: element, rendered: take, owner: 'take', onRegionChange: () => {} })
  return surface ? <div key={nodeKey} ref={setElement} /> : null
}

describe('useWaveSurfer', () => {
  it('draws a take on a surface that appears after the first render', () => {
    // The editor shows nothing until a take is loaded, so the surface is NEVER there on the
    // first render of the drop path — and an instance built against a ref read then is one
    // that never gets built at all.
    const { rerender } = render(<Editor surface={false} />)
    expect(create).not.toHaveBeenCalled()

    rerender(<Editor surface />)
    expect(loadBlob).toHaveBeenCalledOnce()
  })

  it('draws it again on a surface that replaced the first', () => {
    // What detaching a panel does: the take is unchanged, and only the node it was drawn on is
    // gone. Reloading is not optional — the new instance has nothing in it.
    const { rerender } = render(<Editor surface />)
    loadBlob.mockClear()

    rerender(<Editor surface nodeKey="two" />)
    expect(destroy).toHaveBeenCalled()
    expect(loadBlob).toHaveBeenCalledOnce()
  })

  // The two marks of this surface sit on top of one another — an area a drag laid down, a line a
  // click moved — and wavesurfer's own greys give them neither the studio's colours nor a
  // difference to read: the area is the accent VEILED, the head the accent at full.
  describe('its palette', () => {
    const NAMES = ['--color-muted', '--color-accent', '--color-accent-veil']

    function theme(wave: string, head: string, veil: string): void {
      const { style } = document.documentElement
      style.setProperty('--color-muted', wave)
      style.setProperty('--color-accent', head)
      style.setProperty('--color-accent-veil', veil)
      act(() => refreshPalette())
    }

    afterEach(() => {
      for (const name of NAMES) document.documentElement.style.removeProperty(name)
      refreshPalette()
    })

    it('draws the selected area and the head apart, in the studio palette', () => {
      theme('rgb(4, 5, 6)', 'rgb(1, 2, 3)', 'rgba(1, 2, 3, 0.35)')

      render(<Editor surface />)

      // Whole rather than matched: `cursorWidth: 0` draws no head at all, and the played part
      // tinted is the third fill this palette exists to keep out — two changes a partial
      // assertion lets through while claiming to hold the pair.
      expect(setOptions.mock.calls.at(-1)?.[0]).toEqual({
        waveColor: 'rgb(4, 5, 6)',
        progressColor: 'rgb(4, 5, 6)',
        cursorColor: 'rgb(1, 2, 3)',
        cursorWidth: 2,
      })
      // On the drag rather than on the region once it lands: what is being traced is drawn too.
      expect(dragSelection).toHaveBeenLastCalledWith({ color: 'rgba(1, 2, 3, 0.35)' })
    })

    it('follows a theme switched under a wave already drawn', () => {
      // The instance holds its colours in JavaScript, so nothing repaints it on its own: read
      // once at build time, this editor is the one surface that keeps the palette it was born
      // under — which is the mistake `useToken` exists to prevent.
      theme('rgb(4, 5, 6)', 'rgb(1, 2, 3)', 'rgba(1, 2, 3, 0.35)')
      render(<Editor surface />)
      create.mockClear()

      theme('rgb(9, 9, 9)', 'rgb(7, 7, 7)', 'rgba(7, 7, 7, 0.35)')

      expect(setOptions.mock.calls.at(-1)?.[0]).toMatchObject({
        waveColor: 'rgb(9, 9, 9)',
        cursorColor: 'rgb(7, 7, 7)',
      })
      expect(dragSelection).toHaveBeenLastCalledWith({ color: 'rgba(7, 7, 7, 0.35)' })
      // Repainted, not rebuilt: a new instance would come up empty and the take would vanish.
      expect(create).not.toHaveBeenCalled()
    })
  })

  /**
   * The same wheel vocabulary the strip and the programme monitor answer — the state behind it is
   * wavesurfer's pixels-per-second rather than a viewport, but the gesture must not differ.
   */
  describe('the wheel over a take', () => {
    // Restated per case: one of them shortens the take, and a mock left short would silently
    // rescale the cases after it.
    beforeEach(() => duration.mockReturnValue(2))

    const wheeled = (event: Partial<WheelEvent>): void => {
      const { container } = render(<Editor surface />)
      const surface = container.querySelector('div')
      if (!surface) throw new Error('the editor drew no surface')

      act(() => {
        surface.dispatchEvent(
          new WheelEvent('wheel', { bubbles: true, cancelable: true, ...event }),
        )
      })
    }

    it('zooms in on a modified wheel, from whatever the take was fitted at', () => {
      wheeled({ deltaY: -100, ctrlKey: true })

      // 200 px a second fitted, one notch of 1.25 in.
      expect(zoom).toHaveBeenLastCalledWith(250)
    })

    it('never dezooms past the take laid across the panel', () => {
      wheeled({ deltaY: 100, ctrlKey: true })

      expect(zoom).toHaveBeenLastCalledWith(200)
    })

    /**
     * A two-tenths bang on a wide panel fits at a scale past the ceiling, and `clamp` answers its
     * HIGH bound when the two bounds cross — so the first zoom IN would have zoomed out.
     */
    it('does not zoom out on a take too short to fill the panel at full scale', () => {
      duration.mockReturnValue(0.1)
      wheeled({ deltaY: -100, ctrlKey: true })

      // 400 px over a tenth of a second is 4 000 px a second, past the 2 000 ceiling.
      expect(zoom).toHaveBeenLastCalledWith(2_000)
    })

    it('scrolls the take sideways on a plain wheel, touching no zoom', () => {
      zoom.mockClear()
      wheeled({ deltaX: 30 })

      expect(setScroll).toHaveBeenLastCalledWith(70)
      expect(zoom).not.toHaveBeenCalled()
    })

    it('turns a vertical wheel horizontal under shift, for a single-axis mouse', () => {
      wheeled({ deltaY: 30, shiftKey: true })

      expect(setScroll).toHaveBeenLastCalledWith(70)
    })

    /**
     * A take arriving is drawn fitted to the panel. Kept, the zoom would have been the PREVIOUS
     * take's pixels-per-second, and the first notch would have jumped from the fit straight to a
     * scale nothing on screen was ever drawn at.
     */
    it('forgets the zoom when another take is loaded', () => {
      const view = render(<Editor surface />)
      const surface = view.container.querySelector('div')
      if (!surface) throw new Error('the editor drew no surface')

      const wheel = () =>
        act(() => {
          surface.dispatchEvent(
            new WheelEvent('wheel', {
              bubbles: true,
              cancelable: true,
              deltaY: -100,
              ctrlKey: true,
            }),
          )
        })

      wheel()
      wheel()
      expect(zoom).toHaveBeenLastCalledWith(312.5)

      // A shorter take, fitted at 400 pixels a second — one notch in is 500, never 390.
      duration.mockReturnValue(1)
      view.rerender(<Editor surface rendered={{ ...rendered, wav: new Uint8Array(16) }} />)
      wheel()

      expect(zoom).toHaveBeenLastCalledWith(500)
    })
  })
})
