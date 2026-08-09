import { beforeEach, describe, expect, it } from 'vitest'
import { layoutShowing } from './layout-fixtures'
import { useLayouts, type SerializedLayout } from './layouts'

// The store never reads a layout back, it only stores and returns it — the marker is what
// tells two of them apart.
const layout = (marker: string): SerializedLayout => layoutShowing(marker)

describe('layouts store', () => {
  beforeEach(() => {
    localStorage.clear()
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

  describe('prune', () => {
    it('takes the panel out of the workspace holding it', () => {
      useLayouts.getState().remember('image', layoutShowing('kept', 'ghost'))

      useLayouts.getState().prune(new Set(['ghost']))

      expect(Object.keys(useLayouts.getState().layouts.image?.panels ?? {})).toEqual(['kept'])
    })

    it('reaches every workspace, not the one in front', () => {
      useLayouts.getState().remember('image', layoutShowing('kept'))
      useLayouts.getState().remember('3d', layoutShowing('ghost'))

      useLayouts.getState().prune(new Set(['ghost']))

      expect(useLayouts.getState().layouts['3d']).toBeUndefined()
      expect(useLayouts.getState().layouts.image?.panels).toHaveProperty('kept')
    })

    it('forgets a layout left with no panel rather than storing an empty one', () => {
      useLayouts.getState().remember('image', layoutShowing('ghost'))

      useLayouts.getState().prune(new Set(['ghost']))

      expect(useLayouts.getState().layouts.image).toBeUndefined()
    })

    // Every launch calls this, and a layout replaced by an equal one is a write to
    // `localStorage` for nothing — and a new identity for whoever subscribes to it.
    it('leaves the layouts alone when none of them shows one', () => {
      useLayouts.getState().remember('image', layoutShowing('kept'))
      const before = useLayouts.getState().layouts

      useLayouts.getState().prune(new Set(['elsewhere']))

      expect(useLayouts.getState().layouts).toBe(before)
    })
  })

  // Only Dockview can read a layout back, so a build whose Dockview — or whose set of document
  // kinds — has moved on cannot tell whether a stored one still loads. It throws on restore if
  // it does not, which is why the stamp exists rather than a migration.
  describe('persisted format', () => {
    it('drops what an older build stored instead of handing it to Dockview', async () => {
      localStorage.setItem(
        'scenario-studio:layouts',
        JSON.stringify({
          state: { activeWorkspace: 'image', layouts: { image: layout('generator') } },
          version: 0,
        }),
      )

      await useLayouts.persist.rehydrate()

      expect(useLayouts.getState().layouts).toEqual({})
    })
  })

  describe('adopt', () => {
    // A panel is a document open, and the documents live in the project folder: kept across a
    // change of project, the tabs of the previous one come back over a folder that has none.
    it('drops the arrangement of the project being left', () => {
      useLayouts.getState().adopt('/projects/first')
      useLayouts.getState().remember('image', layout('generator'))

      useLayouts.getState().adopt('/projects/second')

      expect(useLayouts.getState().layouts.image).toBeUndefined()
      expect(useLayouts.getState().projectPath).toBe('/projects/second')
    })

    // The main process reopens the last project on launch: taking that for a change of project
    // would greet the user with an empty centre every single time.
    it('keeps the arrangement when the same project comes back', () => {
      useLayouts.getState().adopt('/projects/first')
      useLayouts.getState().remember('image', layout('generator'))

      useLayouts.getState().adopt('/projects/first')

      expect(useLayouts.getState().layouts.image?.panels).toHaveProperty('generator')
    })

    it('drops the arrangement when no project is open any more', () => {
      useLayouts.getState().adopt('/projects/first')
      useLayouts.getState().remember('image', layout('generator'))

      useLayouts.getState().adopt(null)

      expect(useLayouts.getState().layouts.image).toBeUndefined()
    })
  })
})
