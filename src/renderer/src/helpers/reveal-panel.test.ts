import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_OPEN, useTools } from '@/stores/tools'
import { useLayouts } from '@/stores/layouts'
import { revealAssets } from './reveal-panel'

beforeEach(() => {
  useTools.setState({ open: {}, focusedZone: null })
  useLayouts.setState({ activeWorkspace: 'image' })
})

/**
 * The shelf is the bottom band in Image and the right column in Video. A half whose placement
 * does not match its zone renders a different panel altogether, so opening it in the wrong one
 * shows the layers instead — and quietly rewrites the user's layout on the way.
 */
describe('revealing the shelf', () => {
  it('opens it in the half this workspace puts it in', () => {
    revealAssets()

    expect(useTools.getState().open.bottom?.primary).toBe('assets')
    expect(useTools.getState().open.right).toBeUndefined()
  })

  it('follows the workspace rather than a fixed corner', () => {
    useLayouts.setState({ activeWorkspace: 'video' })

    revealAssets()

    expect(useTools.getState().open.right?.primary).toBe('assets')
  })

  it('focuses the band rather than reopening it when it is already there', () => {
    useTools.setState({ open: { bottom: { primary: 'assets' } } })

    revealAssets()

    expect(useTools.getState().focusedZone).toBe('bottom')
  })

  it('leaves a default layout exactly as it found it', () => {
    useTools.setState({ open: DEFAULT_OPEN })

    revealAssets()

    expect(useTools.getState().open).toEqual(DEFAULT_OPEN)
    expect(useTools.getState().focusedZone).toBe('bottom')
  })
})
