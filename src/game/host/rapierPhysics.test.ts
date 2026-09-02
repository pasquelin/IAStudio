// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IDENTITY_TRANSFORM, type Transform } from '@shared/domain/transform'
import type { BodyDescriptor, PhysicsPort } from '../ports/physicsPort'
import type { ColliderShape } from '../physics/shape'
import { loadRapierPhysics } from './rapierPhysics'

const STEP = 1 / 60

const at = (x: number, y: number, z: number): Transform => ({
  ...IDENTITY_TRANSFORM,
  position: { x, y, z },
})

const body = (
  over: Partial<BodyDescriptor> & Pick<BodyDescriptor, 'body' | 'shape'>,
): BodyDescriptor => ({
  kind: 'dynamic',
  transform: IDENTITY_TRANSFORM,
  friction: 0.6,
  restitution: 0,
  mass: 0,
  gravityScale: 1,
  lockRotation: false,
  sensor: false,
  character: null,
  vehicle: null,
  ...over,
})

const FLOOR: ColliderShape = { kind: 'cuboid', hx: 20, hy: 0.5, hz: 20 }

const poseOf = (port: PhysicsPort, name: string) =>
  [...port.poses()].find(pose => pose.body === name) ?? null

/** Runs `count` steps and answers where `name` ended up, or nothing if it never moved. */
function run(port: PhysicsPort, count: number, name: string): { x: number; y: number; z: number } {
  let last = { x: 0, y: 0, z: 0 }
  for (let step = 0; step < count; step++) {
    port.step(STEP)
    const pose = poseOf(port, name)
    if (pose) last = { ...pose.position }
  }
  return last
}

describe('the physics as Rapier fills it', () => {
  let port: PhysicsPort

  // One WORLD per case, one ENGINE for the file: `loadRapierPhysics` instantiates the
  // WebAssembly once and hands back a fresh world every time. Cases sharing one world let a
  // floor left behind by a failing case hold up the body of the next.
  beforeEach(async () => {
    port = await loadRapierPhysics()
    port.setGravity(-9.81)
  })

  afterEach(() => {
    port.dispose()
  })

  it('drops a box onto a floor and leaves it standing there', () => {
    port.add([
      body({ body: 'floor', kind: 'fixed', shape: FLOOR, transform: at(0, -0.5, 0) }),
      body({
        body: 'crate',
        shape: { kind: 'cuboid', hx: 0.5, hy: 0.5, hz: 0.5 },
        transform: at(0, 5, 0),
      }),
    ])

    const landed = run(port, 180, 'crate')

    expect(landed.y).toBeGreaterThan(0.4)
    expect(landed.y).toBeLessThan(0.6)
  })

  /** A body a step never woke has nothing to report, and reading it back would cost a pose a frame. */
  it('says nothing of a body that has settled', () => {
    port.add([
      body({ body: 'floor', kind: 'fixed', shape: FLOOR, transform: at(0, -0.5, 0) }),
      body({ body: 'crate', shape: { kind: 'ball', radius: 0.5 }, transform: at(0, 1, 0) }),
    ])

    run(port, 600, 'crate')

    expect(poseOf(port, 'crate')).toBeNull()
  })

  it('refuses a body whose points enclose nothing, by name', () => {
    const refused = port.add([
      body({ body: 'flat', shape: { kind: 'hull', points: new Float32Array([0, 0, 0, 1, 0, 0]) } }),
    ])

    expect(refused).toEqual(['flat'])
  })

  /**
   * 🛑 The whole point of the controller, and what elected Rapier: a character walks INTO a wall
   * and stops at it rather than through it.
   */
  it('walks a character up to a wall and no further', () => {
    port.add([
      body({ body: 'floor', kind: 'fixed', shape: FLOOR, transform: at(0, -0.5, 0) }),
      body({
        body: 'wall',
        kind: 'fixed',
        shape: { kind: 'cuboid', hx: 5, hy: 2, hz: 0.5 },
        transform: at(0, 2, -4),
      }),
      body({
        body: 'walker',
        kind: 'kinematic',
        shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.3 },
        transform: at(0, 0.9, 0),
        character: { stepHeight: 0.5, slopeLimit: 45, snapDistance: 0.5 },
      }),
    ])

    for (let step = 0; step < 300; step++) {
      port.moveCharacters([{ body: 'walker', wanted: { x: 0, y: -0.05, z: -0.05 } }])
      port.step(STEP)
    }

    const walker = poseOf(port, 'walker')
    // The wall's near face stands at z = -3.5, and the capsule keeps its radius plus the skin.
    expect(walker?.position.z ?? 0).toBeGreaterThan(-3.5)
    expect(walker?.position.y ?? 0).toBeGreaterThan(0.5)
  })

  it('says a character is grounded when it stands on something, and not when it does not', () => {
    port.add([
      body({ body: 'floor', kind: 'fixed', shape: FLOOR, transform: at(0, -0.5, 0) }),
      body({
        body: 'walker',
        kind: 'kinematic',
        shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.3 },
        transform: at(0, 0.9, 0),
        character: { stepHeight: 0.5, slopeLimit: 45, snapDistance: 0.5 },
      }),
      body({
        body: 'flyer',
        kind: 'kinematic',
        shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.3 },
        transform: at(6, 20, 0),
        character: { stepHeight: 0.5, slopeLimit: 45, snapDistance: 0.5 },
      }),
    ])

    // One step first: a body added since the last one is not in the broadphase the controller
    // queries, so it would be told it stands over nothing.
    port.step(STEP)
    const moved = port.moveCharacters([
      { body: 'walker', wanted: { x: 0, y: -0.02, z: 0 } },
      { body: 'flyer', wanted: { x: 0, y: -0.02, z: 0 } },
    ])

    expect(moved.find(one => one.body === 'walker')?.grounded).toBe(true)
    expect(moved.find(one => one.body === 'flyer')?.grounded).toBe(false)
  })

  /** Both ways round, so each side of a pair can act on it without a second lookup. */
  it('reports a sensor being entered, from both sides and marked as sensed', () => {
    port.add([
      body({
        body: 'gate',
        kind: 'fixed',
        sensor: true,
        shape: { kind: 'cuboid', hx: 2, hy: 2, hz: 2 },
        transform: at(0, 0, 0),
      }),
      body({
        body: 'crate',
        shape: { kind: 'cuboid', hx: 0.5, hy: 0.5, hz: 0.5 },
        transform: at(0, 4, 0),
      }),
    ])

    const met: string[] = []
    for (let step = 0; step < 120; step++) {
      port.step(STEP)
      for (const contact of port.contacts()) {
        if (contact.started && contact.sensed) met.push(`${contact.body}|${contact.other}`)
      }
    }

    expect(met).toContain('gate|crate')
    expect(met).toContain('crate|gate')
  })

  /**
   * 🛑 Rapier SUMS the masses of a body's colliders, so a solid felt as four convex pieces
   * weighed four times what its author asked for and shoved four times as hard.
   */
  it('weighs a body once however many pieces it is felt as', async () => {
    const light = await shoved(1, 4)
    const heavy = await shoved(1, 16)
    const split = await shoved(4, 4)

    // The measure bites — four times the mass drives the floater somewhere else entirely — and
    // four pieces of the declared mass land where one piece of it does.
    expect(Math.abs(heavy - light)).toBeGreaterThan(1)
    expect(split).toBeCloseTo(light, 3)
  })

  /** A pierced wall, felt as the pieces ADR-25 decomposes it into: the window is a way through. */
  it('lets a body through the hole of a compound of convex pieces', () => {
    port.add([
      body({
        body: 'wall',
        kind: 'fixed',
        shape: { kind: 'convexes', parts: pierced() },
        transform: at(0, 0, 0),
      }),
      body({ body: 'crate', shape: { kind: 'ball', radius: 0.2 }, transform: at(0, 4, 0) }),
    ])

    const fallen = run(port, 180, 'crate')

    // Through the opening, which is why it is below where the slab stands.
    expect(fallen.y).toBeLessThan(-1)
  })
})

/**
 * How far a weightless floater is driven down by a body dropped on it — the only reading of a
 * mass a port with no accessor can give, since a free fall is the same at every mass.
 */
async function shoved(pieces: number, mass: number): Promise<number> {
  const port = await loadRapierPhysics()
  port.setGravity(-9.81)
  port.add([
    body({
      body: 'floater',
      shape: { kind: 'ball', radius: 0.5 },
      transform: at(0, 1, 0),
      gravityScale: 0,
      mass: 1,
    }),
    body({
      body: 'weight',
      shape: { kind: 'convexes', parts: Array.from({ length: pieces }, cube) },
      transform: at(0, 4, 0),
      mass,
    }),
  ])

  for (let step = 0; step < 120; step++) port.step(STEP)
  const driven = 1 - ([...port.poses()].find(pose => pose.body === 'floater')?.position.y ?? 1)
  port.dispose()
  return driven
}

/** The same cube however many times: only the COUNT of colliders differs between the two runs. */
const cube = (): Float32Array =>
  new Float32Array([
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
    0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
  ])

/**
 * A slab three metres wide with a one-metre square missing in the middle, as four boxes. What
 * `convexesOfGraph` produces, written by hand so this file owes the CSG nothing.
 */
function pierced(): Float32Array[] {
  const bar = (x: number, z: number, hx: number, hz: number): Float32Array => {
    const points: number[] = []
    for (const dx of [-hx, hx]) {
      for (const dy of [-0.1, 0.1]) {
        for (const dz of [-hz, hz]) points.push(x + dx, dy, z + dz)
      }
    }
    return new Float32Array(points)
  }

  return [bar(-1, 0, 0.5, 1.5), bar(1, 0, 0.5, 1.5), bar(0, -1, 0.5, 0.5), bar(0, 1, 0.5, 0.5)]
}
