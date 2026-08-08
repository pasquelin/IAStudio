import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_OPEN, useTools } from '@/stores/tools'
import { revealAssets, zoneShowing } from './reveal-assets'

beforeEach(() => {
  useTools.setState({ open: {}, focusedZone: null })
})

describe('finding the shelf', () => {
  it('names the zone showing it, whichever half it sits in', () => {
    expect(zoneShowing({ right: { secondary: 'assets' } }, 'assets')).toBe('right')
  })

  it('says nothing when it is nowhere', () => {
    expect(zoneShowing({ left: { primary: 'explorer' } }, 'assets')).toBeNull()
  })
})

describe('revealing the shelf', () => {
  // Where the user put it wins: opening a second copy in the default corner would answer a
  // click by rearranging their layout.
  it('focuses the zone that already shows it rather than opening another', () => {
    useTools.setState({ open: { bottom: { primary: 'assets' } } })

    revealAssets()

    expect(useTools.getState().focusedZone).toBe('bottom')
    expect(useTools.getState().open.left).toBeUndefined()
  })

  it('opens it where it belongs when no zone shows it', () => {
    revealAssets()

    expect(useTools.getState().open.left?.primary).toBe('assets')
  })

  it('leaves a default layout exactly as it found it', () => {
    useTools.setState({ open: DEFAULT_OPEN })

    revealAssets()

    expect(useTools.getState().open).toEqual(DEFAULT_OPEN)
  })
})
