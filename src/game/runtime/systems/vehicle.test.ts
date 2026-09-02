// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { JsonValue } from '@shared/domain/component'
import { newComponent } from '@shared/domain/componentRegistry'
import { notedPhysics, type NotedPhysics } from '../../physics/physics-fixtures'
import { restingTransform } from '../entity'
import { STEP_SECONDS } from '../gameLoop'
import { createPilots, PILOT_RANK, type Pilots } from '../pilots'
import { testPorts, testWorld } from '../world-fixtures'
import type { World } from '../world'
import { createVehicleSystem } from './vehicle'

type Bench = { world: World; physics: NotedPhysics; pilots: Pilots }

function bench(held: readonly string[] = [], over: Record<string, JsonValue> = {}): Bench {
  const physics = notedPhysics()
  const pilots = createPilots()
  const world = testWorld({
    ports: testPorts({ physics }),
    systems: [createVehicleSystem(pilots)],
  })
  world.entities.add({
    id: 'car',
    name: 'car',
    transform: restingTransform(),
    components: [newComponent('RigidBody'), { ...newComponent('Vehicle'), ...over }],
  })
  world.ports.input.state = () => ({
    held,
    pressed: [],
    released: [],
    pointer: { x: 0, y: 0, down: false },
  })
  return { world, physics, pilots }
}

/** What the driver was last asked for, after `steps` steps at the scene's own pace. */
const asked = (bench: Bench, steps = 1) => {
  for (let step = 0; step < steps; step++) bench.world.step(STEP_SECONDS)
  // A whole FRAME, steps and all: the seat is claimed at the image, where the camera reads it.
  bench.world.lateUpdate(0, STEP_SECONDS)
  return bench.physics.driven.at(-1) ?? null
}

/** Rolling along its own nose at that speed — the sign a brake is told from a reversal by. */
const rolling = (bench: Bench, along: number): void => {
  bench.physics.answers.motion = [
    { body: 'car', linear: { x: 0, y: 0, z: -along }, angular: { x: 0, y: 0, z: 0 } },
  ]
}

describe('what a car is driven by', () => {
  it('asks for nothing while no key is held', () => {
    expect(asked(bench())).toEqual({ body: 'car', forward: 0, steer: 0, brake: 0, handBrake: 0 })
  })

  it('opens the throttle forward and closes it in reverse', () => {
    expect(asked(bench(['KeyW']))?.forward).toBe(1)
    expect(asked(bench(['KeyS']))?.forward).toBe(-1)
  })

  it('steers by the two keys, and not past full lock on both', () => {
    expect(asked(bench(['KeyD']))?.steer).toBe(1)
    expect(asked(bench(['ArrowLeft']))?.steer).toBe(-1)
    expect(asked(bench(['KeyA', 'KeyD']))?.steer).toBe(0)
  })

  /**
   * 🛑 The whole reason this system holds state. Handed straight through, a car asked to reverse
   * at speed spins its wheels backwards against the road, and reads as one that will not stop.
   */
  it('brakes rather than reverses while the car still rolls forward', () => {
    const car = bench(['KeyS'])
    rolling(car, 6)

    expect(asked(car)).toMatchObject({ forward: 0, brake: 1 })
  })

  it('takes the reverse once the car has come to a stop', () => {
    const car = bench(['KeyS'])
    rolling(car, 6)
    asked(car)
    rolling(car, 0)

    expect(asked(car)).toMatchObject({ forward: -1, brake: 0 })
  })

  it('holds the car on the hand brake, whatever the pedal says', () => {
    expect(asked(bench(['Space', 'KeyW']))).toMatchObject({ forward: 0, handBrake: 1 })
  })

  it('puts the driver in the seat the camera rides in', () => {
    const car = bench()
    asked(car)

    expect(car.pilots.leader()?.entity.id).toBe('car')
  })

  it('leaves the seat empty for a step nothing claimed', () => {
    expect(createPilots().leader()).toBeNull()
  })

  /**
   * 🛑 A car destroyed mid-game stops claiming, and a seat nobody empties would frame a dead
   * entity for the rest of the session — the two machine templates ship no walker to take it back.
   */
  it('empties the seat once the camera has looked, so a destroyed car is not framed for ever', () => {
    const car = bench()
    asked(car)
    expect(car.pilots.leader()?.entity.id).toBe('car')

    // Destroyed at the END of the step it was asked in, so the claim of that step still lands.
    car.world.destroy('car')
    asked(car)
    car.pilots.release()
    asked(car)

    expect(car.pilots.leader()).toBeNull()
  })

  /** A walker is what the player IS; a car is what it drives, and loses the seat to one. */
  it('gives the seat to a walker over a machine, whichever claimed first', () => {
    const pilots = createPilots()
    const machine = { id: 'car' } as unknown as Parameters<typeof pilots.take>[0]
    const walker = { id: 'hero' } as unknown as Parameters<typeof pilots.take>[0]
    pilots.take(machine, 0.35, 9, PILOT_RANK.machine)
    pilots.take(walker, 0.9, 5, PILOT_RANK.walker)

    expect(pilots.leader()?.entity).toBe(walker)
  })

  it('says nothing at all when the scene holds no vehicle', () => {
    const physics = notedPhysics()
    const world = testWorld({
      ports: testPorts({ physics }),
      systems: [createVehicleSystem(createPilots())],
    })
    world.step(STEP_SECONDS)

    expect(physics.driven).toEqual([])
  })
})
