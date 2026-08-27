import { describe, expect, it } from 'vitest'
import type { TimelineTransition } from '@shared/domain/animation'
import { EMPTY_SCENE, type SceneState } from './sceneState'
import { run, emptyHistory } from '@/engines/core/history'
import { addTimelineRow, removeTimelineRow, setTimelineTemplate } from './timelineCommands'

const EVENT = { id: 'e1', at: 1_000, name: 'DoorOpened' }
const ran = (state: SceneState, ...commands: ReturnType<typeof setTimelineTemplate>[]) =>
  commands.reduce(
    (held, command) => {
      const [next, history] = run(held.state, held.history, command)
      return { state: next, history }
    },
    { state, history: emptyHistory<SceneState>() },
  )

describe('what a timeline cues, put there and taken back', () => {
  it('puts a row on its list, and an undo takes it away', () => {
    const held = ran(EMPTY_SCENE, addTimelineRow('events', EVENT))

    expect(held.state.animation.events).toEqual([EVENT])
    expect(held.history.past.at(-1)?.revert(held.state).animation.events).toEqual([])
  })

  /** 🛑 The last transition of the list decides an overlap, so WHERE it comes back matters. */
  it('gives a removed row back where it was, not at the end', () => {
    const rows: TimelineTransition[] = [
      { id: 't1', at: 0, kind: 'fade', duration: 100 },
      { id: 't2', at: 50, kind: 'fade', duration: 100 },
      { id: 't3', at: 90, kind: 'cut', duration: 0 },
    ]
    const three = ran(EMPTY_SCENE, ...rows.map(row => addTimelineRow('transitions', row)))
    const without = ran(three.state, removeTimelineRow('transitions', 't2'))

    const back = without.history.past.at(-1)?.revert(without.state)
    expect(back?.animation.transitions?.map(one => one.id)).toEqual(['t1', 't2', 't3'])
  })

  it('replaces the row already under that id rather than doubling it', () => {
    const once = ran(EMPTY_SCENE, addTimelineRow('events', EVENT))
    const twice = ran(once.state, addTimelineRow('events', { ...EVENT, name: 'DoorShut' }))

    expect(twice.state.animation.events).toEqual([{ ...EVENT, name: 'DoorShut' }])
  })

  /** A command the state refuses leaves the document alone, and says so to whoever asked. */
  it('refuses a row already there as asked, and a removal of nothing', () => {
    const held = ran(EMPTY_SCENE, addTimelineRow('events', EVENT))

    expect(addTimelineRow('events', EVENT).refuses?.(held.state)).toBe(true)
    expect(removeTimelineRow('events', 'nobody').refuses?.(held.state)).toBe(true)
  })

  it('sets which rows the panel offers, and gives the one before back', () => {
    const first = ran(EMPTY_SCENE, setTimelineTemplate('intro'))
    const second = ran(first.state, setTimelineTemplate('cinematic'))

    expect(second.state.animation.template).toBe('cinematic')
    expect(second.history.past.at(-1)?.revert(second.state).animation.template).toBe('intro')
  })

  /** A scene that never had one comes back without one, not with an empty string. */
  it('gives back no template at all when there was none', () => {
    const held = ran(EMPTY_SCENE, setTimelineTemplate('intro'))
    const back = held.history.past.at(-1)?.revert(held.state)

    expect(back?.animation.template).toBeUndefined()
  })
})
