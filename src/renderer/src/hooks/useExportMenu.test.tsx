import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { useExportMenu } from './useExportMenu'

const listening = (inFront: boolean) => {
  const stop = vi.fn()
  const listen = vi.fn(() => stop)
  const { rerender, unmount } = renderHook(
    ({ front }: { front: boolean }) => useExportMenu(front, listen),
    { initialProps: { front: inFront } },
  )
  return { listen, stop, rerender, unmount }
}

describe('a native export row armed for the tab in front', () => {
  beforeEach(() => installFakeBridge())

  it('subscribes for the tab in front', () => {
    const { listen } = listening(true)

    expect(listen).toHaveBeenCalledTimes(1)
  })

  /**
   * A hidden tab stays MOUNTED, and the event goes to the window rather than to a document: two
   * open skies both answering one click of the same row would both open a folder dialog.
   */
  it('stays silent for a tab that is not', () => {
    const { listen } = listening(false)

    expect(listen).not.toHaveBeenCalled()
  })

  it('lets go the moment the tab leaves the front', () => {
    const { stop, rerender } = listening(true)

    rerender({ front: false })

    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('lets go when the document closes', () => {
    const { stop, unmount } = listening(true)

    unmount()

    expect(stop).toHaveBeenCalledTimes(1)
  })

  // A plain browser and a test have no preload bridge, and asking one for a menu is not a failure.
  it('subscribes to nothing without a bridge', () => {
    vi.stubGlobal('studio', undefined)
    const { listen } = listening(true)

    expect(listen).not.toHaveBeenCalled()
  })
})
