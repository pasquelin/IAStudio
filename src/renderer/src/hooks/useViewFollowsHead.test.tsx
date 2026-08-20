import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Viewport } from '@/engines/timeline/timelineGeometry'
import type { Us } from '@/engines/timeline/timelineState'
import { useViewFollowsHead, type HeadFrame } from './useViewFollowsHead'

/** One second across a 600 px surface, so the frame shows the first second and nothing after. */
const SHOWING_ONE_SECOND: Viewport = { scale: 600 / 1_000_000, offset: 0, scrollTop: 0 }

const following = (frame: HeadFrame) => {
  const reveal = vi.fn()
  const { rerender } = renderHook(
    ({ playhead }: { playhead: Us }) => useViewFollowsHead(playhead, () => frame, reveal),
    { initialProps: { playhead: 0 } },
  )
  return { reveal, moveHeadTo: (playhead: Us) => rerender({ playhead }) }
}

describe('a time surface that follows the head', () => {
  it('scrolls once the head has left the frame', () => {
    const { reveal, moveHeadTo } = following({ viewport: SHOWING_ONE_SECOND, width: 600 })

    moveHeadTo(5_000_000)

    expect(reveal).toHaveBeenCalledTimes(1)
    expect(reveal.mock.calls[0]?.[0].offset).not.toBe(SHOWING_ONE_SECOND.offset)
  })

  it('leaves a surface alone while the head is inside it', () => {
    const { reveal, moveHeadTo } = following({ viewport: SHOWING_ONE_SECOND, width: 600 })

    moveHeadTo(500_000)

    expect(reveal).not.toHaveBeenCalled()
  })

  /**
   * A surface with nothing to scroll — a montage shown whole, a panel not laid out yet — answers
   * with no frame. Every instant reads as off-frame against a width of zero, so a scroll written
   * there would drag a fitted view off its own montage.
   */
  it('writes nothing when there is no frame to scroll', () => {
    const { reveal, moveHeadTo } = following(null)

    moveHeadTo(5_000_000)

    expect(reveal).not.toHaveBeenCalled()
  })

  it('writes nothing on a surface that has not been laid out', () => {
    const { reveal, moveHeadTo } = following({ viewport: SHOWING_ONE_SECOND, width: 0 })

    moveHeadTo(5_000_000)

    expect(reveal).not.toHaveBeenCalled()
  })
})
