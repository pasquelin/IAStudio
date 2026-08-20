import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SKYBOX_VIEW, useSkyboxViews, skyboxViewOf } from './skyboxViews'

describe('how a sky is being looked at', () => {
  beforeEach(() => useSkyboxViews.setState({ views: {} }))

  it('opens on the same defaults for a document nobody has touched', () => {
    expect(skyboxViewOf(useSkyboxViews.getState(), 'sky-1')).toEqual(DEFAULT_SKYBOX_VIEW)
  })

  /** A selector building its default per call hands React a new snapshot on every render. */
  it('hands back one object for an untouched document, not a fresh one each time', () => {
    const state = useSkyboxViews.getState()

    expect(skyboxViewOf(state, 'sky-1')).toBe(skyboxViewOf(state, 'sky-2'))
  })

  it('changes one setting without disturbing the others', () => {
    useSkyboxViews.getState().set('sky-1', { fieldOfView: 90 })

    expect(skyboxViewOf(useSkyboxViews.getState(), 'sky-1')).toEqual({
      ...DEFAULT_SKYBOX_VIEW,
      fieldOfView: 90,
    })
  })

  it('keeps two documents apart', () => {
    useSkyboxViews.getState().set('sky-1', { probes: false })

    expect(skyboxViewOf(useSkyboxViews.getState(), 'sky-2').probes).toBe(true)
  })

  it('walks the projections in order and comes back round', () => {
    const seen: string[] = []
    for (let step = 0; step < 5; step += 1) {
      useSkyboxViews.getState().cycleView('sky-1')
      seen.push(skyboxViewOf(useSkyboxViews.getState(), 'sky-1').view)
    }

    expect(seen).toEqual(['equirect', 'cross', 'faces', 'immersive', 'equirect'])
  })

  // A record per document that never leaves is a leak for the length of a session — and a
  // reopened id would come back to the view its predecessor left behind.
  it('forgets a document that closed', () => {
    useSkyboxViews.getState().set('sky-1', { fieldOfView: 90 })
    useSkyboxViews.getState().forget('sky-1')

    expect(useSkyboxViews.getState().views).toEqual({})
  })

  it('stays as it was when asked to forget one it never held', () => {
    const before = useSkyboxViews.getState().views
    useSkyboxViews.getState().forget('sky-9')

    expect(useSkyboxViews.getState().views).toBe(before)
  })
})
