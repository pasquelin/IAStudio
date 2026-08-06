import { beforeEach, describe, expect, it } from 'vitest'
import { useLayouts, type SerializedLayout } from './layouts'

function layout(marker: string): SerializedLayout {
  return {
    grid: { root: { type: 'branch', data: [] }, width: 0, height: 0, orientation: 'HORIZONTAL' },
    panels: { [marker]: { id: marker, contentComponent: marker } },
  } as SerializedLayout
}

describe('store des dispositions', () => {
  beforeEach(() => {
    useLayouts.setState({ activeWorkspace: 'image', layouts: {} })
  })

  it('mémorise une disposition par espace', () => {
    const { remember } = useLayouts.getState()
    remember('image', layout('generator'))
    remember('3d', layout('viewport'))

    const { layouts } = useLayouts.getState()
    expect(layouts.image?.panels).toHaveProperty('generator')
    expect(layouts['3d']?.panels).toHaveProperty('viewport')
  })

  it('restitue la disposition mémorisée après un changement d’espace', () => {
    const { remember, setActiveWorkspace } = useLayouts.getState()
    remember('image', layout('generator'))
    setActiveWorkspace('3d')
    setActiveWorkspace('image')

    const state = useLayouts.getState()
    expect(state.activeWorkspace).toBe('image')
    expect(state.layouts.image?.panels).toHaveProperty('generator')
  })

  it('oublie la disposition d’un seul espace', () => {
    const { remember, forget } = useLayouts.getState()
    remember('image', layout('generator'))
    remember('audio', layout('tracks'))
    forget('image')

    const { layouts } = useLayouts.getState()
    expect(layouts.image).toBeUndefined()
    expect(layouts.audio?.panels).toHaveProperty('tracks')
  })
})
