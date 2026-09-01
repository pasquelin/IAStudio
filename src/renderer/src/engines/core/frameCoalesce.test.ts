import { describe, expect, it, vi } from 'vitest'
import { createFrameCoalesce } from './frameCoalesce'

describe('frame coalesce', () => {
  it('runs the latest value once, on the next animation frame', () => {
    const queued: FrameRequestCallback[] = []
    const raf = (callback: FrameRequestCallback): number => {
      queued.push(callback)
      return queued.length
    }
    const coalesce = createFrameCoalesce(raf, vi.fn())
    const apply = vi.fn()

    coalesce.schedule(1, apply)
    coalesce.schedule(2, apply)
    coalesce.schedule(3, apply)

    expect(apply).not.toHaveBeenCalled()
    queued[0]?.(0)
    expect(apply).toHaveBeenCalledOnce()
    expect(apply).toHaveBeenCalledWith(3)
  })

  it('runs the latest value immediately when flushed', () => {
    const queued: FrameRequestCallback[] = []
    const raf = (callback: FrameRequestCallback): number => {
      queued.push(callback)
      return 7
    }
    const caf = vi.fn()
    const coalesce = createFrameCoalesce(raf, caf)
    const apply = vi.fn()

    coalesce.schedule(4, apply)
    coalesce.flush()

    expect(caf).toHaveBeenCalledWith(7)
    expect(apply).toHaveBeenCalledWith(4)
    queued[0]?.(0)
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('forgets a scheduled value when cancelled', () => {
    const queued: FrameRequestCallback[] = []
    const raf = (callback: FrameRequestCallback): number => {
      queued.push(callback)
      return 7
    }
    const caf = vi.fn()
    const coalesce = createFrameCoalesce(raf, caf)
    const apply = vi.fn()

    coalesce.schedule(1, apply)
    coalesce.cancel()
    queued[0]?.(0)

    expect(caf).toHaveBeenCalledWith(7)
    expect(apply).not.toHaveBeenCalled()
  })
})
