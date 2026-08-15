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

  /**
   * Three readings in a panel a third of a screen tall is the crowding this monitor was asked to
   * avoid: the two a montage is judged on stand, the third is offered.
   */
  it('keeps the spectrum folded away until it is asked for', () => {
    show()

    expect(screen.queryByRole('img', { name: 'Spectre' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Spectre/ }))

    expect(screen.getByRole('img', { name: 'Spectre' })).toBeInTheDocument()
  })

  it('folds it back without touching the transport', () => {
    const { player } = show()
    const button = screen.getByRole('button', { name: /Spectre/ })

    fireEvent.click(button)
    fireEvent.click(button)

    expect(screen.queryByRole('img', { name: 'Spectre' })).not.toBeInTheDocument()
    expect(player.toggle).not.toHaveBeenCalled()
    expect(player.rewind).not.toHaveBeenCalled()
  })

  it('shows the output level beside the wave, whether or not anything is playing', () => {
    show()

    expect(screen.getByRole('img', { name: 'Niveau de sortie' })).toBeInTheDocument()
  })

  /**
   * Ten minutes of music fitted to a panel is a green band with no shape in it. The wheel is the
   * one the strip and the dope sheet answer, so the gesture carries across surfaces.
   */
  it('zooms under the pointer, and says so by disarming the fit', () => {
    show()
    const canvas = wave()
    const fit = screen.getByRole('button', { name: /Tout le montage/ })

    expect(fit).toHaveAttribute('aria-pressed', 'true')

    fireEvent.wheel(canvas, { deltaY: -100, ctrlKey: true, clientX: 200 })

    expect(fit).toHaveAttribute('aria-pressed', 'false')
  })

  it('goes back to the whole montage when the fit is asked for', () => {
    show()
    fireEvent.wheel(wave(), { deltaY: -100, ctrlKey: true, clientX: 200 })
    const fit = screen.getByRole('button', { name: /Tout le montage/ })

    fireEvent.click(fit)

    expect(fit).toHaveAttribute('aria-pressed', 'true')
  })

  /** Fitted to the width there is nowhere to scroll to, so a plain wheel must change nothing. */
  it('stays fitted under a wheel that only scrolls', () => {
    show()

    fireEvent.wheel(wave(), { deltaY: 100, clientX: 200 })

    expect(screen.getByRole('button', { name: /Tout le montage/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  /**
   * The curves are drawn inside the wave, so they cost no room — but they cross the very crests
   * one may be reading instead, and a reader who has no use for them can put them away.
   */
  it('offers the curves as something to take away, and starts with them shown', () => {
    show()
    const button = screen.getByRole('button', { name: /Courbes/ })

    expect(button).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(button)

    expect(button).toHaveAttribute('aria-pressed', 'false')
  })
})
