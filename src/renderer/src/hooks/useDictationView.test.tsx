import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { useDictationView } from './useDictationView'

/** One spoken sentence, as the engine publishes it: the whole hypothesis again, every time. */
const HEARD = ['un', 'un phare', 'un phare sur', 'un phare sur la côte']

beforeEach(() => {
  installFakeBridge()
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({ state: 'idle', partial: '', level: 0, failure: null, download: null })
})

/** How many times a component reading this view is asked to render. */
function rendersOf(): { count: () => number } {
  let renders = 0
  renderHook(() => {
    renders += 1
    return useDictationView()
  })
  const mount = renders
  return { count: () => renders - mount }
}

describe('what a component sees of dictation', () => {
  /**
   * `Heard` and `LevelMeter` subscribe on their own, which is the whole reason each is a
   * component rather than a paragraph in its three hosts.
   */
  it('carries neither the running hypothesis nor the input level', () => {
    const { result } = renderHook(() => useDictationView())

    expect(result.current).not.toHaveProperty('partial')
    expect(result.current).not.toHaveProperty('level')
  })

  /**
   * The property check alone would pass on a selector read into a local and never returned —
   * which wakes the three hosts just the same. One `act` apiece: a batch is one commit.
   */
  it('leaves its hosts alone while the hypothesis is replaced', () => {
    const renders = rendersOf()

    for (const heard of HEARD) act(() => useDictation.setState({ partial: heard }))

    expect(renders.count()).toBe(0)
  })

  it('leaves its hosts alone while the input level moves', () => {
    const renders = rendersOf()

    for (const level of [0.1, 0.2, 0.3, 0.4]) act(() => useDictation.setState({ level }))

    expect(renders.count()).toBe(0)
  })

  it('carries the state a host actually reads', () => {
    useDictation.setState({ state: 'listening' })
    const { result } = renderHook(() => useDictationView())

    expect(result.current.state).toBe('listening')
    expect(result.current.isListening).toBe(true)
    expect(result.current.enabled).toBe(true)
  })
})
