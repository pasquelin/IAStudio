// SPDX-License-Identifier: MIT

import type { InputState } from '../ports/inputPort'
import type { CharacterMove, CharacterMoved, CharacterSettings } from '../ports/physicsPort'
import { clamp } from '../numeric'
import { numberOf } from './componentFields'
import { COMPONENT_DEFAULTS } from './componentDefaults'
import { componentOf, type Entity } from './entity'
import type { Look } from './playView'
import type { World } from './world'

const WALKER = COMPONENT_DEFAULTS.CharacterController

/** `KeyboardEvent.code`, so a key is the one under the finger whatever the layout says it types. */
const FORWARD = ['KeyW', 'ArrowUp']
const BACK = ['KeyS', 'ArrowDown']
const LEFT = ['KeyA', 'ArrowLeft']
const RIGHT = ['KeyD', 'ArrowRight']
const JUMP = 'Space'

/** Metres a second a fall stops getting faster at: past it a step tunnels through a thin floor. */
const TERMINAL_FALL = 50

/** Radians of turn per pixel dragged. */
const LOOK_PER_PIXEL = 0.005

/** A hair under straight up, where yaw and pitch would turn about the same axis. */
const PITCH_LIMIT = Math.PI / 2 - 0.01

const FULL_TURN = Math.PI * 2

/**
 * Kept pressing into the floor while standing. Zero would let `snapToGround` lose a character
 * walking down a slope, which then falls the whole step rather than following the ground.
 */
const GROUNDED_PULL = -1

/** What one character remembers between steps. Its pose belongs to the entity, not here. */
type Walker = { velocityY: number; wantedY: number; grounded: boolean }

export type Characters = {
  /** What each one asks to move this step, read off the input and the scene's own pace. */
  intents: (world: World, dt: number) => readonly CharacterMove[]
  /** What actually happened, back from the controller. */
  settle: (moved: readonly CharacterMoved[]) => void
  settingsOf: (entity: Entity) => CharacterSettings
  /**
   * The capsule an entity is FELT as, and what the eye height is measured down from. Read in one
   * place: a body 0,2 tall around a radius of 5 is ten metres of capsule, and a camera trusting
   * the field alone would put the eye five metres under the floor.
   */
  capsuleOf: (entity: Entity) => { halfHeight: number; radius: number }
  /** Who the camera watches: the first entity that declared a controller. */
  leader: () => Entity | null
  look: () => Look
}

/**
 * What turns keys and a drag into a movement the physics is allowed to correct. The pace, the
 * pull and the eye height are the SCENE's (`world.play`); the component holds the body itself.
 *
 * 🛑 One look for the whole world: there is one pointer, so a second controller walks the same
 * heading.
 */
export function createCharacters(): Characters {
  const walkers = new WeakMap<Entity, Walker>()
  const byBody = new Map<string, Walker>()
  // `pool` HOLDS the moves and never shrinks; `moves` is the list handed to the port.
  const pool: CharacterMove[] = []
  const moves: CharacterMove[] = []
  const look: Look = { yaw: 0, pitch: 0 }
  const pace = { x: 0, z: 0 }
  let first: Entity | null = null
  let dragged: { x: number; y: number } | null = null

  const turn = (input: InputState): void => {
    if (!input.pointer.down) {
      dragged = null
      return
    }
    if (dragged) {
      // Wrapped, like `normalizeAzimuth` does for the viewport: a session spent turning one way
      // walks the yaw off into large floats, where a radian stops resolving a degree.
      look.yaw = (look.yaw - (input.pointer.x - dragged.x) * LOOK_PER_PIXEL) % FULL_TURN
      look.pitch -= (input.pointer.y - dragged.y) * LOOK_PER_PIXEL
      look.pitch = clamp(look.pitch, -PITCH_LIMIT, PITCH_LIMIT)
    }
    dragged = { x: input.pointer.x, y: input.pointer.y }
  }

  return {
    intents: (world, dt) => {
      turn(world.input)
      moves.length = 0
      byBody.clear()
      first = null

      for (const entity of world.entities.withComponent('CharacterController')) {
        const settings = componentOf(entity, 'CharacterController')
        if (!settings) continue
        first ??= entity

        const walker = walkers.get(entity) ?? { velocityY: 0, wantedY: 0, grounded: false }
        walkers.set(entity, walker)

        if (walker.grounded && world.input.pressed.includes(JUMP)) {
          walker.velocityY = numberOf(settings, 'jumpSpeed', WALKER.jumpSpeed)
        }
        walker.velocityY = Math.max(walker.velocityY - world.play.gravity * dt, -TERMINAL_FALL)
        walker.wantedY = walker.velocityY * dt

        paceInto(pace, world.input, world.play.moveSpeed * dt, look.yaw)
        let move = pool[moves.length]
        if (!move) {
          move = { body: '', wanted: { x: 0, y: 0, z: 0 } }
          pool.push(move)
        }
        move.body = entity.id
        move.wanted.x = pace.x
        move.wanted.y = walker.wantedY
        move.wanted.z = pace.z
        moves.push(move)
        byBody.set(entity.id, walker)
      }

      return moves
    },

    settle: moved => {
      for (const one of moved) {
        const walker = byBody.get(one.body)
        if (!walker) continue
        walker.grounded = one.grounded
        // Standing: held at a constant press rather than at zero, so `snapToGround` keeps a grip
        // on the ground of a slope walked down instead of losing it for a step.
        if (one.grounded && walker.velocityY <= 0) walker.velocityY = GROUNDED_PULL
        // Head against a ceiling: the rise was refused, and a velocity nobody cleared would make
        // the character hang there until the whole jump had been spent.
        else if (walker.wantedY > 0 && one.moved.y < walker.wantedY / 2) walker.velocityY = 0
      }
    },

    settingsOf: entity => {
      const settings = componentOf(entity, 'CharacterController')
      return {
        stepHeight: numberOf(settings, 'stepHeight', WALKER.stepHeight),
        slopeLimit: numberOf(settings, 'slopeLimit', WALKER.slopeLimit),
        snapDistance: numberOf(settings, 'snapDistance', WALKER.snapDistance),
      }
    },

    capsuleOf: entity => {
      const settings = componentOf(entity, 'CharacterController')
      const radius = numberOf(settings, 'radius', WALKER.radius)
      const height = numberOf(settings, 'height', WALKER.height)
      return { halfHeight: Math.max(0, height / 2 - radius), radius }
    },

    leader: () => first,
    look: () => look,
  }
}

/** Level, and never faster on the diagonal: two keys held would otherwise walk at 1,41 times. */
function paceInto(
  into: { x: number; z: number },
  input: InputState,
  step: number,
  yaw: number,
): void {
  const ahead = pressed(input, FORWARD) - pressed(input, BACK)
  const side = pressed(input, RIGHT) - pressed(input, LEFT)
  const length = Math.hypot(ahead, side)
  const walk = length === 0 ? 0 : step / length

  into.x = (-Math.sin(yaw) * ahead + Math.cos(yaw) * side) * walk
  into.z = (-Math.cos(yaw) * ahead - Math.sin(yaw) * side) * walk
}

/** Indexed on both sides: this is read four times per character per step. */
function pressed(input: InputState, keys: readonly string[]): number {
  for (let key = 0; key < keys.length; key++) {
    for (let held = 0; held < input.held.length; held++) {
      if (input.held[held] === keys[key]) return 1
    }
  }
  return 0
}
