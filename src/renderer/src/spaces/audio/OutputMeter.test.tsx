import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AudioTap } from '@/engines/timeline/soundSchedule'
import { OutputMeter } from './OutputMeter'

/** A tap that always hears the same thing, and counts how often it was asked. */
const tapWith = (peak: number) => {
  const levels = vi.fn(() => new Float32Array([peak, -peak / 2]))
  const tap: AudioTap = { levels, frequencies: () => new Uint8Array(), sampleRate: 48_000 }
  return { tap, levels }
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

describe('OutputMeter', () => {
  it('names itself for a reader, a bar being a picture with nothing to read in it', () => {
    render(<OutputMeter tap={() => null} playing={false} />)

    expect(screen.getByRole('img', { name: 'Niveau de sortie' })).toBeInTheDocument()
  })

  /**
   * A meter animating over a stopped montage is sixty wake-ups a second to paint the same
   * picture — the frame budget of the tab, spent on a bar that is not moving.
   */
  it('asks for no frame at all while the montage is stopped', () => {
    const clock = frames()
    const { tap, levels } = tapWith(0.5)

    render(<OutputMeter tap={() => tap} playing={false} />)

    expect(clock.pending).toHaveLength(0)
    expect(levels).not.toHaveBeenCalled()
  })

  it('listens on every frame once the montage plays', () => {
    const clock = frames()
    const { tap, levels } = tapWith(0.5)

    render(<OutputMeter tap={() => tap} playing />)
    clock.advance(0)
    clock.advance(16)

    expect(levels).toHaveBeenCalledTimes(2)
  })

  /** Nothing has opened an output yet, which is the state a tab spends most of its life in. */
  it('keeps running when there is nothing to listen to', () => {
    const clock = frames()

    render(<OutputMeter tap={() => null} playing />)

    expect(() => clock.advance(0)).not.toThrow()
    expect(clock.pending).toHaveLength(1)
  })

  it('stops asking for frames once the montage does', () => {
    const clock = frames()
    const { tap } = tapWith(0.5)
    const view = render(<OutputMeter tap={() => tap} playing />)
    clock.advance(0)

    view.rerender(<OutputMeter tap={() => tap} playing={false} />)
    clock.pending.length = 0
    clock.advance(32)

    expect(clock.pending).toHaveLength(0)
  })
})
