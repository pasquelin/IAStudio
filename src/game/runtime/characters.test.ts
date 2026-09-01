// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { newComponent } from '@shared/domain/componentRegistry'
import { DEFAULT_PLAY } from '@shared/domain/scene'
import type { InputState } from '../ports/inputPort'
import { createCharacters } from './characters'
import { restingTransform } from './entity'
import { testWorld } from './world-fixtures'
import type { World } from './world'

const STEP = 1 / 60

const pressing = (over: Partial<InputState> = {}): InputState => ({
  held: [],
  pressed: [],
  released: [],
  pointer: { x: 0, y: 0, down: false },
  ...over,
})

function walking(gravity = 0, moveSpeed = 4): World {
  const world = testWorld({ play: { ...DEFAULT_PLAY, gravity, moveSpeed } })
  world.entities.add({
    id: 'walker',
    name: 'Walker',
    transform: restingTransform(),
    components: [newComponent('CharacterController')],
  })
  return world
}

describe('what a character asks to move', () => {
  it('walks forward on the key under the finger, whatever it types', () => {
    const world = walking()
    world.input = pressing({ held: ['KeyW'] })

    const [move] = createCharacters().intents(world, STEP)

    expect(move?.wanted.z).toBeCloseTo(-4 * STEP, 6)
    expect(move?.wanted.x).toBeCloseTo(0, 6)
  })

  /** Two keys held would otherwise walk at 1,41 times the pace the scene declares. */
  it('never walks faster on the diagonal', () => {
    const world = walking()
    world.input = pressing({ held: ['KeyW', 'KeyD'] })

    const [move] = createCharacters().intents(world, STEP)

    expect(Math.hypot(move?.wanted.x ?? 0, move?.wanted.z ?? 0)).toBeCloseTo(4 * STEP, 6)
  })

  it('falls by the pull the SCENE declares, not by one of its own', () => {
    const world = walking(10)

    const [move] = createCharacters().intents(world, STEP)

    expect(move?.wanted.y).toBeCloseTo(-10 * STEP * STEP, 8)
  })

  /** A jump from nothing is how a character climbs a wall it should not. */
  it('jumps only from the ground', () => {
    const world = walking(10)
    const characters = createCharacters()
    world.input = pressing({ pressed: ['Space'] })

    const inAir = characters.intents(world, STEP)[0]?.wanted.y ?? 0
    characters.settle([{ body: 'walker', moved: { x: 0, y: 0, z: 0 }, grounded: true }])
    const grounded = characters.intents(world, STEP)[0]?.wanted.y ?? 0

    expect(inAir).toBeLessThan(0)
    expect(grounded).toBeGreaterThan(0)
  })

  /** A fall nobody stopped keeps getting faster, and a character standing still would sink. */
  it('stops gaining speed once it is standing on something', () => {
    const world = walking(10)
    const characters = createCharacters()

    for (let step = 0; step < 60; step++) {
      characters.intents(world, STEP)
      characters.settle([{ body: 'walker', moved: { x: 0, y: 0, z: 0 }, grounded: true }])
    }

    expect(characters.intents(world, STEP)[0]?.wanted.y ?? 0).toBeGreaterThan(-0.05)
  })

  it('turns the heading with a drag, and never past straight up', () => {
    const world = walking()
    const characters = createCharacters()

    world.input = pressing({ pointer: { x: 100, y: 100, down: true } })
    characters.intents(world, STEP)
    world.input = pressing({ pointer: { x: 0, y: -100000, down: true } })
    characters.intents(world, STEP)

    expect(characters.look().yaw).toBeGreaterThan(0)
    expect(characters.look().pitch).toBeLessThan(Math.PI / 2)
  })

  it('names the first controller as the one the camera watches', () => {
    const world = walking()
    const characters = createCharacters()

    characters.intents(world, STEP)
    const leader = characters.leader()

    expect(leader?.id).toBe('walker')
    // 1,8 tall around a radius of 0,3: the straight part is what is left of it.
    const capsule = leader ? characters.capsuleOf(leader) : null
    expect(capsule?.halfHeight).toBeCloseTo(0.6, 6)
    expect(capsule?.radius).toBeCloseTo(0.3, 6)
  })
})
