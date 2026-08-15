import { render } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RenderedAudio } from '@/engines/audio/audio-render'
import { refreshPalette } from '@/engines/core/palette'
import { useWaveSurfer } from './useWaveSurfer'

const loadBlob = vi.fn(() => Promise.resolve())
const destroy = vi.fn()
const dragSelection = vi.fn((_options: unknown) => {})
const create = vi.fn((_options: unknown) => ({
  on: vi.fn(),
  loadBlob,
  destroy,
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
}

function Editor({ surface, nodeKey = 'one' }: { surface: boolean; nodeKey?: string }) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  useWaveSurfer({ container: element, rendered, owner: 'take', onRegionChange: () => {} })
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

  it('draws the selected area and the head apart, in the studio palette', () => {
    // The two marks of this surface sit on top of one another — an area a drag laid down, a line
    // a click moved — and wavesurfer's own greys give them neither the studio's colours nor a
    // difference to read: the area is the accent VEILED, the head the accent at full.
    const root = document.documentElement
    root.style.setProperty('--color-muted', 'rgb(4, 5, 6)')
    root.style.setProperty('--color-accent', 'rgb(1, 2, 3)')
    root.style.setProperty('--color-accent-veil', 'rgba(1, 2, 3, 0.35)')
    refreshPalette()

    // Restored even on a failed assertion: the palette is a module cache.
    try {
      render(<Editor surface />)

      expect(create.mock.calls.at(-1)?.[0]).toMatchObject({
        waveColor: 'rgb(4, 5, 6)',
        cursorColor: 'rgb(1, 2, 3)',
      })
      // On the drag rather than on the region once it lands: what is being traced is drawn too.
      expect(dragSelection).toHaveBeenCalledWith({ color: 'rgba(1, 2, 3, 0.35)' })
    } finally {
      for (const name of ['--color-muted', '--color-accent', '--color-accent-veil']) {
        root.style.removeProperty(name)
      }
      refreshPalette()
    }
  })
})
