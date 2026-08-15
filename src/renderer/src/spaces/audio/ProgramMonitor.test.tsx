import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { clipFixture, sequenceWith, trackFixture } from '@/engines/timeline/timeline-fixtures'
import { ProgramMonitor } from './ProgramMonitor'
import type { SoundTransport } from './useSoundTransport'

/** Four seconds of sound on one track, so a click halfway across is two seconds in. */
const montage = () => sequenceWith([trackFixture('a', 'audio', [clipFixture('c', 0, 4 * SECOND)])])

const transport = (playing = false): SoundTransport => ({
  playing,
  toggle: vi.fn(),
  rewind: vi.fn(),
  tap: () => null,
})

function show(overrides: { playing?: boolean; onSeek?: (time: number) => void } = {}) {
  const player = transport(overrides.playing)
  const onSeek = overrides.onSeek ?? vi.fn()
  render(<ProgramMonitor sequence={montage()} transport={player} onSeek={onSeek} />)
  return { player, onSeek }
}

/**
 * jsdom lays nothing out, so the canvas measures zero and `programViewport` would scale by zero.
 * The width is declared where the component reads it — off the bounding box, not off the element.
 *
 * The FIRST canvas: the meter stands beside the wave, and only the wave is scrubbed on.
 */
function wave(width = 400): HTMLElement {
  const canvas = document.querySelector('canvas')
  if (!canvas) throw new Error('the monitor drew no canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 100 }) as DOMRect
  return canvas
}

describe('ProgramMonitor', () => {
  /** The whole montage always fits the width, so half the box is half the montage. */
  it('puts the head where the montage was clicked', () => {
    const { onSeek } = show()

    fireEvent.pointerDown(wave(), { clientX: 200 })

    expect(onSeek).toHaveBeenCalledWith(2 * SECOND)
  })

  /**
   * A pointer that starts on the wave and lands past its end still reports a coordinate — the
   * head has nowhere to go beyond the last frame, and a montage that scrubbed past its own end
   * would play silence it never holds.
   */
  it('keeps the head inside the montage, however far the pointer goes', () => {
    const { onSeek } = show()

    fireEvent.pointerDown(wave(), { clientX: 4000 })

    expect(onSeek).toHaveBeenCalledWith(4 * SECOND)
  })

  it('plays through the transport it was handed', () => {
    const { player } = show()

    fireEvent.click(screen.getByRole('button', { name: /Lire/ }))

    expect(player.toggle).toHaveBeenCalled()
  })

  it('rewinds rather than playing when the head is sent back', () => {
    const { player } = show()

    fireEvent.click(screen.getByRole('button', { name: /Retour au début/ }))

    expect(player.rewind).toHaveBeenCalled()
    expect(player.toggle).not.toHaveBeenCalled()
  })

  /** The one button says which way it goes: a monitor already playing offers to stop. */
  it('offers to pause while it plays', () => {
    show({ playing: true })

    expect(screen.getByRole('button', { name: /Pause/ })).toBeInTheDocument()
  })
})
