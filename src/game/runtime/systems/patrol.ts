// SPDX-License-Identifier: MIT

import { COMPONENT_DEFAULTS } from '../componentDefaults'
import { componentOf, type Entity } from '../entity'
import { numberOf, textOf } from '../componentFields'
import { stepTowards } from '../steering'
import type { System, World } from '../world'

const PATROL = COMPONENT_DEFAULTS.Patrol

/** Where a walker is in its round: which mark it wants, which way it goes, and what it waits. */
type Round = { at: number; forward: boolean; waited: number; done: boolean }

/**
 * What walks from one NAMED mark to the next, waiting at each — a sentry, a lift.
 *
 * The marks are entities, not points, and that is the whole difference with `Path`: an author
 * moves the mark in the scene and the sentry follows it, without editing a string of numbers.
 */
export function createPatrolSystem(): System {
  const rounds = new WeakMap<Entity, Round>()
  const marks: Entity[] = []

  return {
    name: 'patrol',
    reads: ['Patrol'],
    writes: [],

    fixedUpdate: (world: World, dt: number) => {
      for (const entity of world.entities.withComponent('Patrol')) {
        const settings = componentOf(entity, 'Patrol')
        if (!settings) continue

        marks.length = 0
        for (const said of textOf(settings, 'waypoints', PATROL.waypoints).split(',')) {
          const name = said.trim()
          const mark = name === '' ? null : (world.entities.get(name) ?? namedIn(world, name))
          if (mark && mark !== entity) marks.push(mark)
        }
        if (marks.length === 0) continue

        const round = rounds.get(entity) ?? { at: 0, forward: true, waited: 0, done: false }
        rounds.set(entity, round)
        if (round.done) continue

        if (round.waited > 0) {
          round.waited = Math.max(0, round.waited - dt)
          continue
        }

        const mark = marks[Math.min(round.at, marks.length - 1)]
        if (!mark) continue

        const reach = numberOf(settings, 'speed', PATROL.speed) * dt
        if (!stepTowards(entity.transform.position, mark.transform.position, reach)) continue

        round.waited = numberOf(settings, 'waitSeconds', PATROL.waitSeconds)
        advance(round, marks.length, textOf(settings, 'mode', PATROL.mode))
      }
    },
  }
}

/** The first entity wearing that name. A sweep, and a round names a handful of marks. */
function namedIn(world: World, name: string): Entity | null {
  for (const entity of world.entities.all()) if (entity.name === name) return entity
  return null
}

/** `once` stops at the far end; the two others fold the round back, by wrapping or by walking it back. */
function advance(round: Round, count: number, mode: string): void {
  if (mode === 'loop') {
    round.at = (round.at + 1) % count
    return
  }
  if (mode === 'once') {
    if (round.at + 1 >= count) round.done = true
    else round.at += 1
    return
  }

  // pingPong, and the default.
  if (round.forward && round.at + 1 >= count) round.forward = false
  else if (!round.forward && round.at === 0) round.forward = true
  round.at = Math.max(0, Math.min(count - 1, round.at + (round.forward ? 1 : -1)))
}
