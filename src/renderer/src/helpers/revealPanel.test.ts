import { beforeEach, describe, expect, it } from 'vitest'
import { arrangedFor } from '@/stores/tool-fixtures'
import { DEFAULT_ARRANGEMENTS, DEFAULT_OPEN, arrangementOf, useTools } from '@/stores/tools'
import { useLayouts } from '@/stores/layouts'
import { revealAssets } from './revealPanel'

beforeEach(() => {
  useTools.setState({ arrangements: arrangedFor('image', { open: {} }), focusedZone: null })
  useLayouts.setState({ activeWorkspace: 'image', home: false })
})

/**
 * The shelf is the bottom band in Image and the right column in Video. A half whose placement
 * does not match its zone renders a different panel altogether, so opening it in the wrong one
 * shows the layers instead — and quietly rewrites the user's layout on the way.
 */
describe('revealing the shelf', () => {
  it('opens it in the half this workspace puts it in', () => {
    revealAssets()

    expect(arrangementOf(useTools.getState(), 'image').open.bottomRight?.primary).toBe('assets')
    expect(arrangementOf(useTools.getState(), 'image').open.right).toBeUndefined()
  })

  it('follows the workspace rather than a fixed corner', () => {
    useLayouts.setState({ activeWorkspace: 'video' })

    revealAssets()

    expect(arrangementOf(useTools.getState(), 'image').open.right?.primary).toBe('assets')
  })

  it('focuses the band rather than reopening it when it is already there', () => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: { bottomRight: { primary: 'assets' } } }),
    })

    revealAssets()

    expect(useTools.getState().focusedZone).toBe('bottomRight')
  })

  it('leaves a default layout exactly as it found it', () => {
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })

    revealAssets()

    expect(arrangementOf(useTools.getState(), 'image').open).toEqual(DEFAULT_OPEN.workspaces)
    expect(useTools.getState().focusedZone).toBe('bottomRight')
  })
})
