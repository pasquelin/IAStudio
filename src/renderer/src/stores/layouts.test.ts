import { beforeEach, describe, expect, it } from 'vitest'
import { Orientation } from 'dockview-react'
import { useLayouts, type SerializedLayout } from './layouts'

function layout(marker: string): SerializedLayout {
  // Minimal shape: the store never reads a layout back, it only stores and returns it.
  const value: SerializedLayout = {
    grid: {
      root: { type: 'branch', data: [] },
      width: 0,
      height: 0,
      orientation: Orientation.HORIZONTAL,
    },
    panels: { [marker]: { id: marker, contentComponent: marker } },
  }
  return value
}

describe('layouts store', () => {
  beforeEach(() => {
    useLayouts.setState({ activeWorkspace: 'image', layouts: {} })
  })

  it('remembers one layout per workspace', () => {
    const { remember } = useLayouts.getState()
    remember('image', layout('generator'))
    remember('3d', layout('viewport'))

    const { layouts } = useLayouts.getState()
    expect(layouts.image?.panels).toHaveProperty('generator')
    expect(layouts['3d']?.panels).toHaveProperty('viewport')
  })

  it('keeps the remembered layout across a workspace switch', () => {
    const { remember, setActiveWorkspace } = useLayouts.getState()
    remember('image', layout('generator'))
    setActiveWorkspace('3d')
    setActiveWorkspace('image')

    const state = useLayouts.getState()
    expect(state.activeWorkspace).toBe('image')
    expect(state.layouts.image?.panels).toHaveProperty('generator')
  })

  it('forgets a single workspace layout', () => {
    const { remember, forget } = useLayouts.getState()
    remember('image', layout('generator'))
    remember('audio', layout('tracks'))
    forget('image')

    const { layouts } = useLayouts.getState()
    expect(layouts.image).toBeUndefined()
    expect(layouts.audio?.panels).toHaveProperty('tracks')
  })
})
