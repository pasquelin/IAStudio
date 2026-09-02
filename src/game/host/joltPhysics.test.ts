// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IDENTITY_TRANSFORM, type Transform } from '@shared/domain/transform'
import type { BodyDescriptor, PhysicsPort, VehicleSettings } from '../ports/physicsPort'
import type { ColliderShape } from '../physics/shape'
import { joltFreeBytes, loadJoltPhysics } from './joltPhysics'

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

/** A flat quad as two triangles: the least a mesh can be, and enough to be refused for moving. */
const QUAD = {
  vertices: new Float32Array([-2, 0, -2, 2, 0, -2, 2, 0, 2, -2, 0, 2]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
}

describe('the physics as Jolt fills it', () => {
  let port: PhysicsPort

  // One WORLD per case, one ENGINE for the file: `loadJoltPhysics` instantiates the WebAssembly
  // once and hands back a fresh world every time. Cases sharing one world let a floor left behind
  // by a failing case hold up the body of the next.
  beforeEach(async () => {
    port = await loadJoltPhysics()
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
   * 🛑 Jolt will not move a mesh, where Rapier would. Named rather than quietly swapped for its
   * hull: a body felt as something other than what it draws is the worse lie of the two.
   */
  it('refuses a mesh that would have to move, and takes the same mesh standing still', () => {
    const refused = port.add([
      body({ body: 'ground', kind: 'fixed', shape: { kind: 'trimesh', ...QUAD } }),
      body({ body: 'flying', kind: 'dynamic', shape: { kind: 'trimesh', ...QUAD } }),
    ])

    expect(refused).toEqual(['flying'])
  })

  /**
   * 🛑 The whole point of the controller: a character walks INTO a wall and stops at it rather
   * than through it.
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
   * 🛑 Rapier SUMMED the masses of a body's colliders and this port divided to undo it. Jolt
   * weighs one shape once, so the division is gone — and this is what says so.
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

  /**
   * 🛑 A Jolt kinematic keeps the velocity it was last handed, so a platform placed once and
   * never again would slide away for ever — and whatever stood on it would be left behind.
   */
  it('holds a kinematic body where it was last placed, on the steps that say nothing', () => {
    port.add([
      body({
        body: 'lift',
        kind: 'kinematic',
        shape: { kind: 'cuboid', hx: 2, hy: 0.25, hz: 2 },
        transform: at(0, 2, 0),
      }),
      body({ body: 'crate', shape: { kind: 'ball', radius: 0.25 }, transform: at(0, 3, 0) }),
    ])

    port.place([
      { body: 'lift', position: { x: 0, y: 2, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
    ])
    const rested = run(port, 240, 'crate')

    expect(rested.y).toBeGreaterThan(2.4)
    expect(rested.y).toBeLessThan(2.6)
  })

  /**
   * 🛑 The defect this port cannot see any other way: every Jolt object lives in a heap nothing
   * collects, and two forgotten vectors a body a step grow that heap past what a window holds after
   * twenty minutes of play — never in a bench.
   */
  it('gives back every byte it took over a thousand steps', async () => {
    port.add([
      body({ body: 'floor', kind: 'fixed', shape: FLOOR, transform: at(0, -0.5, 0) }),
      body({
        body: 'lift',
        kind: 'kinematic',
        shape: { kind: 'cuboid', hx: 2, hy: 0.25, hz: 2 },
        transform: at(6, 1, 0),
      }),
      body({
        body: 'walker',
        kind: 'kinematic',
        shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.3 },
        transform: at(0, 0.9, 0),
        character: { stepHeight: 0.5, slopeLimit: 45, snapDistance: 0.5 },
      }),
      ...Array.from({ length: 40 }, (_, index) =>
        body({
          body: `crate${index}`,
          shape: { kind: 'cuboid', hx: 0.3, hy: 0.3, hz: 0.3 },
          transform: at((index % 8) * 0.8 - 3, 1 + Math.floor(index / 8) * 0.8, 2),
        }),
      ),
    ])

    const frame = (turn: number): void => {
      port.place([
        {
          body: 'lift',
          position: { x: 6, y: 1 + Math.sin(turn * 0.1) * 0.2, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        },
      ])
      port.moveCharacters([{ body: 'walker', wanted: { x: 0.01, y: -0.02, z: 0 } }])
      port.step(STEP)
      port.poses()
      port.contacts()
    }

    // Three windows rather than a before and an after, and exact rather than within a bound: the
    // FIRST five hundred steps do cost a little — 112 bytes, measured — as Jolt's own contact
    // cache reaches its size. Every window after it must be free, and that is what a leak breaks.
    const marks: number[] = []
    for (let window = 0; window < 4; window++) {
      for (let turn = 0; turn < 500; turn++) frame(window * 500 + turn)
      marks.push(await joltFreeBytes())
    }

    expect(marks.slice(1)).toEqual([marks[0], marks[0], marks[0]])
  })
})

/** A hatchback on four wheels, the front pair steering and every wheel driven. Forward is −Z.
 * `at` is where each wheel RESTS: centre 0,45 under the body, so its contact sits 0,80 under it. */
const CAR: VehicleSettings = {
  wheelRadius: 0.35,
  wheelWidth: 0.25,
  suspensionLength: 0.4,
  maxSteerAngle: 30,
  maxTorque: 500,
  wheels: [
    {
      body: 'fl',
      at: { x: -0.9, y: -0.1, z: -1.4 },
      steers: true,
      driven: true,
      handBraked: false,
    },
    {
      body: 'fr',
      at: { x: 0.9, y: -0.45, z: -1.4 },
      steers: true,
      driven: true,
      handBraked: false,
    },
    {
      body: 'bl',
      at: { x: -0.9, y: -0.45, z: 1.4 },
      steers: false,
      driven: true,
      handBraked: true,
    },
    { body: 'br', at: { x: 0.9, y: -0.45, z: 1.4 }, steers: false, driven: true, handBraked: true },
  ],
}

const car = (over: Partial<BodyDescriptor> = {}): BodyDescriptor =>
  body({
    body: 'car',
    shape: { kind: 'cuboid', hx: 0.9, hy: 0.25, hz: 2 },
    transform: at(0, 0.8, 0),
    mass: 1500,
    vehicle: CAR,
    ...over,
  })

describe('what rolls on wheels and what is pushed', () => {
  let port: PhysicsPort

  beforeEach(async () => {
    port = await loadJoltPhysics()
    port.setGravity(-9.81)
    port.add([body({ body: 'floor', kind: 'fixed', shape: FLOOR, transform: at(0, -0.5, 0) })])
  })

  afterEach(() => {
    port.dispose()
  })

  /** Where the car last stood: a car left alone falls asleep, and a sleeper reports no pose. */
  const driven = (forward: number, steer: number, steps: number, handBrake = 0) => {
    let last = { x: 0, y: 0, z: 0 }
    for (let step = 0; step < steps; step++) {
      port.drive([{ body: 'car', forward, steer, brake: 0, handBrake }])
      port.step(STEP)
      const pose = poseOf(port, 'car')
      if (pose) last = { ...pose.position }
    }
    return last
  }

  it('drives a car forward on its suspension when the pedal is down', () => {
    expect(port.add([car()])).toEqual([])
    const settled = driven(0, 0, 60)
    const gone = driven(1, 0, 120)

    // Forward is −Z; the body hangs on its springs rather than resting on the floor.
    expect(gone.z).toBeLessThan(settled.z - 2)
    expect(gone.y).toBeGreaterThan(0.6)
    expect(Math.abs(gone.x)).toBeLessThan(0.2)
  })

  it('turns to the right on a right input, which is +X when heading −Z', () => {
    port.add([car()])
    driven(0, 0, 60)
    const turned = driven(1, 1, 180)

    expect(turned.x).toBeGreaterThan(0.5)
  })

  it('reports each wheel where it stands under the body, every step', () => {
    port.add([car()])
    driven(1, 0, 60)
    const wheels = new Map(port.poses().map(pose => [pose.body, pose.position]))
    const body = wheels.get('car')!

    for (const name of ['fl', 'fr', 'bl', 'br']) {
      const wheel = wheels.get(name)!
      expect(wheel.y).toBeLessThan(body.y)
      expect(wheel.y).toBeGreaterThan(0.1)
      expect(Math.abs(wheel.x - body.x)).toBeCloseTo(0.9, 1)
    }
  })

  it('holds a car still on its hand brake', () => {
    port.add([car()])
    const before = driven(0, 0, 60)
    const held = driven(1, 0, 120, 1)

    expect(Math.abs(held.z - before.z)).toBeLessThan(0.5)
  })

  it('refuses wheels on a body the simulation does not move', () => {
    expect(port.add([car({ kind: 'kinematic' })])).toEqual(['car'])
    expect(port.add([car({ kind: 'fixed' })])).toEqual(['car'])
  })

  it('lifts a body against gravity with a force, and says how it then moves', () => {
    port.add([
      body({
        body: 'crate',
        shape: { kind: 'cuboid', hx: 0.3, hy: 0.3, hz: 0.3 },
        transform: at(0, 2, 0),
        mass: 1,
      }),
    ])
    for (let step = 0; step < 60; step++) {
      port.push([{ body: 'crate', force: { x: 0, y: 30, z: 0 }, torque: { x: 0, y: 0, z: 0 } }])
      port.step(STEP)
    }

    const [motion] = port.motion(['crate', 'nobody'])
    expect(port.motion(['crate', 'nobody'])).toHaveLength(1)
    // Thirty newtons on a kilo against 9,81: it climbs at about twenty metres a second.
    expect(motion!.linear.y).toBeGreaterThan(15)
    expect(poseOf(port, 'crate')!.position.y).toBeGreaterThan(5)
  })

  it('spins a body with a torque', () => {
    port.add([
      body({
        body: 'top',
        shape: { kind: 'cuboid', hx: 0.3, hy: 0.3, hz: 0.3 },
        transform: at(0, 5, 0),
        mass: 1,
        gravityScale: 0,
      }),
    ])
    for (let step = 0; step < 30; step++) {
      port.push([{ body: 'top', force: { x: 0, y: 0, z: 0 }, torque: { x: 0, y: 2, z: 0 } }])
      port.step(STEP)
    }

    expect(port.motion(['top'])[0]!.angular.y).toBeGreaterThan(1)
  })

  it('gives back every byte a vehicle took, cycle after cycle', async () => {
    const marks: number[] = []
    for (let cycle = 0; cycle < 5; cycle++) {
      port.add([car()])
      driven(1, 0.5, 100)
      port.motion(['car'])
      port.remove(['car'])
      marks.push(await joltFreeBytes())
    }

    // Eight bytes of allocator alignment come and go between cycles, measured, and never add
    // up. A leak did: before the by-value copies were freed, each cycle cost 104 and kept costing.
    expect(Math.max(...marks) - Math.min(...marks)).toBeLessThanOrEqual(8)
  })
})

/**
 * How far a weightless floater is driven down by a body dropped on it — the only reading of a
 * mass a port with no accessor can give, since a free fall is the same at every mass.
 */
async function shoved(pieces: number, mass: number): Promise<number> {
  const port = await loadJoltPhysics()
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

/** The same cube however many times: only the COUNT of pieces differs between the two runs. */
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
