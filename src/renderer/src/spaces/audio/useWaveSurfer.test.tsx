import { render } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RenderedAudio } from '@/engines/audio/audio-render'
import { useWaveSurfer } from './useWaveSurfer'

const loadBlob = vi.fn(() => Promise.resolve())
const destroy = vi.fn()
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
    create: () => ({ enableDragSelection: vi.fn(), on: vi.fn(), getRegions: () => [] }),
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
})
