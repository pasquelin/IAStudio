// SPDX-License-Identifier: MIT

import type { AnimationGraph, AnimationLayer } from '@shared/domain/animationGraph'
import {
  advanceAnimator,
  freshAnimator,
  posedClipsOf,
  type AnimatorState,
  type ParameterReading,
} from '../animationMachine'
import type { Animators } from '../animators'
import type { Characters, WalkerReading } from '../characters'
import { textOf } from '../componentFields'
import { componentOf, type Entity } from '../entity'
import { createTargets, type Targets } from '../steering'
import { shortWay } from '../../numeric'
import type { System, World } from '../world'

export type AnimatorSystemOptions = {
  /**
   * The graph a component's `graph` field names, already read and checked. Nothing for a name no
   * file answers: the body then stands in its rest pose rather than the world refusing to run.
   */
  graphOf: (ref: string) => AnimationGraph | null
  /** Shared with the physics, which walks the very bodies this shows. */
  characters: Characters
  /** Shared with the scripts, which write parameters into it and read the played state back. */
  animators: Animators
}

/** What one animated body remembers between steps. Its pose belongs to the port, not here. */
type Held = {
  /** The reference this was built from, so a field pointed elsewhere rebuilds rather than drifts. */
  ref: string
  layer: AnimationLayer
  machine: AnimatorState
  /** The step before, for the frames drawn between two — see `shownAt`. */
  previous: AnimatorState | null
  /** Seconds off the ground, counted here: the walker's own is a flag half the time. */
  airborne: number
  grounded: boolean
  facing: number
}

/**
 * What makes a body LOOK like what it is doing: a state machine per animated entity, run on the
 * fixed step and posed on the frame.
 *
 * 🛑 It sits after `gameplay` and before `timeline` for a reason the order file spells: it reads
 * what the controllers settled this step, and writes nothing any of them will read again.
 */
export function createAnimatorSystem(options: AnimatorSystemOptions): System {
  // Keyed by the ENTITY, as `movement` is: keyed by id, a game that spawns and destroys animated
  // bodies grows the map for the session, and an id given out again inherits the dead one's pose.
  const held = new WeakMap<Entity, Held>()
  const targets = createTargets()
  const posed = new Set<string>()

  return {
    name: 'animator',
    reads: ['Animator', 'CharacterController'],
    writes: [],

    fixedUpdate: (world: World, dt: number) => {
      for (const entity of world.entities.withComponent('Animator')) {
        const current = heldFor(held, entity, options)
        if (!current) continue

        const walker = walkerOf(world, targets, entity, options)
        const reading = readingOf(current, walker, entity.id, options, dt)
        const lengths = world.ports.animation.lengths(entity.id)
        const asked = options.animators.askOf(entity.id)
        const step = advanceAnimator(current.layer, current.machine, reading, lengths, dt, asked)

        current.previous = current.machine
        current.machine = step.next
        options.animators.played(entity.id, step.next.state, step.next.time)

        for (const one of step.happened) {
          if (one.kind === 'finished')
            world.events.emit({
              name: 'AnimationFinished',
              entity: entity.id,
              payload: { state: one.state },
            })
          else
            world.events.emit({
              name: 'AnimationEvent',
              entity: entity.id,
              payload: { state: one.state, event: one.name },
            })
        }
      }
    },

    lateUpdate: (world: World, alpha: number) => {
      for (const entity of world.entities.withComponent('Animator')) {
        const current = held.get(entity)
        if (!current) continue

        const lengths = world.ports.animation.lengths(entity.id)
        world.ports.animation.pose(
          entity.id,
          posedClipsOf(current.layer, shownAt(current, alpha), lengths),
        )
        posed.add(entity.id)
      }
    },

    /** 🛑 Given back, every one: a body left posed keeps the pose a stopped game ended on. */
    dispose: (world: World) => {
      for (const id of posed) {
        world.ports.animation.release(id)
        options.animators.forget(id)
      }
      posed.clear()
    },
  }
}

/** The machine as this FRAME shows it, between the step before and the one just run. */
function shownAt(current: Held, alpha: number): AnimatorState {
  const before = current.previous
  // Only within one state: a machine that changed state last step has no earlier clock to come
  // from, and mixing the two would draw a time inside neither clip.
  if (!before || before.state !== current.machine.state || alpha >= 1) return current.machine

  const from =
    current.machine.from && before.from && before.from.state === current.machine.from.state
      ? { ...current.machine.from, time: mix(before.from.time, current.machine.from.time, alpha) }
      : current.machine.from

  return {
    ...current.machine,
    time: mix(before.time, current.machine.time, alpha),
    faded: mix(before.faded, current.machine.faded, alpha),
    from,
  }
}

const mix = (from: number, to: number, alpha: number): number => from + (to - from) * alpha

/** The state this entity's animator stands in, built or rebuilt for what its component names. */
function heldFor(
  kept: WeakMap<Entity, Held>,
  entity: Entity,
  options: AnimatorSystemOptions,
): Held | null {
  const ref = textOf(componentOf(entity, 'Animator'), 'graph', '')
  const found = kept.get(entity)
  if (found && found.ref === ref) return found

  const layer = options.graphOf(ref)?.layers[0]
  if (!layer) return null

  const made: Held = {
    ref,
    layer,
    machine: freshAnimator(layer),
    previous: null,
    airborne: 0,
    grounded: true,
    facing: 0,
  }
  kept.set(entity, made)
  return made
}

/** The body whose movement drives this animator — the one it names, or itself. */
function walkerOf(
  world: World,
  targets: Targets,
  entity: Entity,
  options: AnimatorSystemOptions,
): WalkerReading | null {
  const named = textOf(componentOf(entity, 'Animator'), 'body', '')
  const body = named === '' ? entity : targets.of(world, entity, named)

  return body ? options.characters.reading(body) : null
}

/**
 * What every condition of the graph reads: what the body is doing, under what a script wrote.
 *
 * 🛑 The built-ins are laid FIRST and a written one wins: a script may drive a parameter of its
 * own, and shadowing `speed` is refused by the parser rather than by an order here.
 */
function readingOf(
  current: Held,
  walker: WalkerReading | null,
  entity: string,
  options: AnimatorSystemOptions,
  dt: number,
): ParameterReading {
  // A graph on a body no controller walks still runs: what a script writes is all it reads.
  if (!walker) return options.animators.writtenOn(entity)

  const speed = Math.hypot(walker.paceX, walker.paceZ)
  // 🛑 Turned back into the body's OWN frame: the pace is composed in the world, so a character
  // walking north with its back turned would read as walking forwards.
  const cos = Math.cos(walker.facing)
  const sin = Math.sin(walker.facing)
  const forward = -(walker.paceZ * cos + walker.paceX * sin)
  const strafe = walker.paceX * cos - walker.paceZ * sin

  // The single step the ground is left with a rise still in the body: a walk off a ledge falls.
  const jumped = current.grounded && !walker.grounded && walker.velocityY > 0
  // The short way round, as every angle of this tree is compared: a body crossing north would
  // otherwise read as spinning a whole turn in one step.
  const turning = dt > 0 ? shortWay(current.facing, walker.facing) / dt : 0
  current.airborne = walker.grounded ? 0 : current.airborne + dt
  current.grounded = walker.grounded
  current.facing = walker.facing

  return {
    speed,
    forward,
    strafe,
    grounded: walker.grounded,
    airborne: current.airborne,
    verticalSpeed: walker.velocityY,
    jumped,
    turning,
    ...options.animators.writtenOn(entity),
  }
}
