import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AudioTap } from '@/engines/timeline/soundSchedule'
import { SpectrumBand } from './SpectrumBand'

const tapWith = () => {
  const frequencies = vi.fn(() => new Uint8Array(512).fill(128))
  const tap: AudioTap = { levels: () => new Float32Array(), frequencies, sampleRate: 48_000 }
  return { tap, frequencies }
}

/** jsdom runs no frames of its own: the suite is the one that advances them. */
const frames = () => {
  const pending: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(step => {
    pending.push(step)
    return pending.length
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

  return { advance: (at: number) => pending.shift()?.(at), pending }
}

afterEach(() => vi.restoreAllMocks())

describe('SpectrumBand', () => {
  it('names itself for a reader, bars being a picture with nothing to read in them', () => {
    render(<SpectrumBand tap={() => null} playing={false} />)

    expect(screen.getByRole('img', { name: 'Spectre' })).toBeInTheDocument()
  })

  /** An analyser has nothing to say about a stopped sequence, and no reason to be running. */
  it('asks for no frame while the montage is stopped', () => {
    const clock = frames()
    const { tap, frequencies } = tapWith()

    render(<SpectrumBand tap={() => tap} playing={false} />)

    expect(clock.pending).toHaveLength(0)
    expect(frequencies).not.toHaveBeenCalled()
  })

  it('reads the analyser on every frame once the montage plays', () => {
    const clock = frames()
    const { tap, frequencies } = tapWith()

    render(<SpectrumBand tap={() => tap} playing />)
    clock.advance(0)
    clock.advance(16)

    expect(frequencies).toHaveBeenCalledTimes(2)
  })

  it('keeps running when there is nothing to listen to', () => {
    const clock = frames()

    render(<SpectrumBand tap={() => null} playing />)

    expect(() => clock.advance(0)).not.toThrow()
    expect(clock.pending).toHaveLength(1)
  })
})
