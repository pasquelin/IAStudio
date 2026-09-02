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

const ORIGIN = { x: 0, y: 0, z: 0 }

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

/** The playground's own stair, as `courtStair` derives it: eight risers of 0,3125 m, 0,6 m of run. */
const STAIR_RISE = 0.3125
const STAIR_RUN = 0.6
const STAIR_STEPS = 8

/** Metres a step at the pace a scene ships with, and the press a grounded character is held at. */
const WALK_PACE = 4 / 60
const GROUND_PRESS = -1 / 60

/** A flight climbing towards +x, each step a slab from the floor up to its own tread, then a landing. */
function flight(): BodyDescriptor[] {
  const steps = Array.from({ length: STAIR_STEPS }, (_, index) => {
    const top = (index + 1) * STAIR_RISE
    return body({
      body: `step${index}`,
      kind: 'fixed',
      shape: { kind: 'cuboid', hx: STAIR_RUN / 2, hy: top / 2, hz: 2 },
      transform: at(index * STAIR_RUN + STAIR_RUN / 2, top / 2, 0),
    })
  })

  const height = STAIR_STEPS * STAIR_RISE
  steps.push(
    body({
      body: 'landing',
      kind: 'fixed',
      shape: { kind: 'cuboid', hx: 2, hy: height / 2, hz: 2 },
      transform: at(STAIR_STEPS * STAIR_RUN + 2, height / 2, 0),
    }),
  )
  return steps
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

  /**
   * 🛑 The gap the two cases around it left: a wall is refused and a floor is stood on, and nothing
   * said what a character does with an obstacle it is meant to walk OVER. The rise is `courtStair`'s.
   */
  it('stops a probe on the near face of a wall, and answers nothing down a clear way', () => {
    port.add([
      body({
        body: 'wall',
        kind: 'fixed',
        shape: { kind: 'cuboid', hx: 0.5, hy: 3, hz: 3 },
        transform: at(5, 0, 0),
      }),
    ])

    // The near face stands at 4,5 of the ten metres asked for.
    expect(port.cast(ORIGIN, { x: 10, y: 0, z: 0 }, 0, [])).toBeCloseTo(0.45, 2)
    expect(port.cast(ORIGIN, { x: 0, y: 0, z: 10 }, 0, [])).toBeNull()
  })

  it('leaves out the bodies it is told to ignore', () => {
    port.add([
      body({
        body: 'near',
        kind: 'fixed',
        shape: { kind: 'cuboid', hx: 0.5, hy: 3, hz: 3 },
        transform: at(2, 0, 0),
      }),
      body({
        body: 'far',
        kind: 'fixed',
        shape: { kind: 'cuboid', hx: 0.5, hy: 3, hz: 3 },
        transform: at(6, 0, 0),
      }),
    ])

    expect(port.cast(ORIGIN, { x: 10, y: 0, z: 0 }, 0, [])).toBeCloseTo(0.15, 2)
    expect(port.cast(ORIGIN, { x: 10, y: 0, z: 0 }, 0, ['near'])).toBeCloseTo(0.55, 2)
  })

  it('stops a thick probe on the slot a ray of no thickness goes through', () => {
    port.add([
      body({
        body: 'left',
        kind: 'fixed',
        shape: { kind: 'cuboid', hx: 0.5, hy: 3, hz: 1.5 },
        transform: at(5, 0, 1.6),
      }),
      body({
        body: 'right',
        kind: 'fixed',
        shape: { kind: 'cuboid', hx: 0.5, hy: 3, hz: 1.5 },
        transform: at(5, 0, -1.6),
      }),
    ])

    expect(port.cast(ORIGIN, { x: 10, y: 0, z: 0 }, 0, [])).toBeNull()
    // On the EDGE at (4,5; 0,1), not on the face: √(0,3² − 0,1²) short of it, so 4,217 of ten.
    expect(port.cast(ORIGIN, { x: 10, y: 0, z: 0 }, 0.3, [])).toBeCloseTo(0.4217, 3)
  })

  it('is not stopped by a sensor, which is what a sensor means', () => {
    port.add([
      body({
        body: 'zone',
        kind: 'fixed',
        sensor: true,
        shape: { kind: 'cuboid', hx: 0.5, hy: 3, hz: 3 },
        transform: at(2, 0, 0),
      }),
      body({
        body: 'wall',
        kind: 'fixed',
        shape: { kind: 'cuboid', hx: 0.5, hy: 3, hz: 3 },
        transform: at(6, 0, 0),
      }),
    ])

    expect(port.cast(ORIGIN, { x: 10, y: 0, z: 0 }, 0, [])).toBeCloseTo(0.55, 2)
  })

  it('gives back every byte a cast took, frame after frame', async () => {
    port.add([
      body({
        body: 'wall',
        kind: 'fixed',
        shape: { kind: 'cuboid', hx: 0.5, hy: 3, hz: 3 },
        transform: at(5, 0, 0),
      }),
    ])

    const marks: number[] = []
    for (let cycle = 0; cycle < 5; cycle++) {
      for (let frame = 0; frame < 60; frame++) {
        port.cast(ORIGIN, { x: 10, y: 0, z: 0 }, 0.3, ['wall'])
        port.cast(ORIGIN, { x: 10, y: 0, z: 0 }, 0, [])
      }
      marks.push(await joltFreeBytes())
    }

    expect(Math.max(...marks) - Math.min(...marks)).toBeLessThanOrEqual(8)
  })

  it('walks a character up a flight of steps and onto the landing above them', () => {
    port.add([
      body({ body: 'floor', kind: 'fixed', shape: FLOOR, transform: at(0, -0.5, 0) }),
      ...flight(),
      body({
        body: 'walker',
        kind: 'kinematic',
        shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.3 },
        transform: at(-1, 0.9, 0),
        character: { stepHeight: 0.5, slopeLimit: 45, snapDistance: 0.5 },
      }),
    ])

    // What `characters.ts` asks for while walking forward on the ground: the pace of a scene, and
    // the constant press into the floor `GROUNDED_PULL` holds a standing character at. Two seconds,
    // which is the flight and a stride onto the landing — a longer walk falls off the far end.
    for (let step = 0; step < 120; step++) {
      port.moveCharacters([{ body: 'walker', wanted: { x: WALK_PACE, y: GROUND_PRESS, z: 0 } }])
      port.step(STEP)
    }

    const walker = poseOf(port, 'walker')
    // The landing stands at 2,5, and the capsule's centre a half height plus a radius above it.
    expect(walker?.position.y ?? 0).toBeGreaterThan(3.3)
    expect(walker?.position.x ?? 0).toBeGreaterThan(STAIR_STEPS * STAIR_RUN)
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
   * 🛑 A sensor is kinematic in Jolt whatever its author declared — see `motionOf`. Read off `kind`
   * alone, one declared DYNAMIC was reported every step and `settle` wrote its frozen pose back
   * over whatever `movement` or `spin` had just written.
   */
  it('leaves a sensor where the game puts it, however its author declared it', () => {
    port.add([
      body({
        body: 'gate',
        sensor: true,
        shape: { kind: 'cuboid', hx: 1, hy: 1, hz: 1 },
        transform: at(0, 2, 0),
      }),
    ])

    port.place([
      { body: 'gate', position: { x: 0, y: 6, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
    ])
    run(port, 60, 'gate')

    // Nothing reported, and nothing fallen: the game owns where a trigger stands.
    expect(poseOf(port, 'gate')).toBeNull()
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

  /**
   * 🛑 Past the ceiling `CreateBody` hands back a null the binder wraps at pointer zero, so the new
   * body answered BodyID 0 — the floor — and took over its contacts and its poses. Measured before
   * the guard: 16 601 bodies added, none refused, and `dispose` threw on the way out.
   */
  it('refuses by name once the body manager is full, and leaves the bodies it holds alone', () => {
    port.add([
      body({ body: 'floor', kind: 'fixed', shape: FLOOR, transform: at(0, -0.5, 0) }),
      body({
        body: 'crate',
        shape: { kind: 'cuboid', hx: 0.5, hy: 0.5, hz: 0.5 },
        transform: at(0, 5, 0),
      }),
    ])

    const crowd = Array.from({ length: 16600 }, (_, index) =>
      body({
        body: `box${index}`,
        kind: 'fixed',
        shape: { kind: 'cuboid', hx: 0.1, hy: 0.1, hz: 0.1 },
        transform: at(10, index * 0.5, 10),
      }),
    )
    const refused = port.add(crowd)

    expect(refused.length).toBeGreaterThan(0)
    expect(refused.every(name => name.startsWith('box'))).toBe(true)
    // The floor still IS the floor: a crate that fell through it would say its identity was taken.
    expect(run(port, 180, 'crate').y).toBeGreaterThan(0)
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

  /**
   * 🛑 The axles were opened from a wheel at `x < 0` alone, so a chassis whose pivot sits on the
   * left wheel line paired nothing: `mDifferentials` stayed empty, `rideOf` still answered a
   * `Ride`, and the engine drove no wheel at all — a car that answers the pedal by standing still.
   */
  it('drives a car whose pivot sits off the middle of its own axles', () => {
    const shifted: VehicleSettings = {
      ...CAR,
      wheels: CAR.wheels.map(wheel => ({ ...wheel, at: { ...wheel.at, x: wheel.at.x + 0.9 } })),
    }
    expect(port.add([car({ vehicle: shifted })])).toEqual([])

    const settled = driven(0, 0, 60)
    const gone = driven(1, 0, 120)

    expect(gone.z).toBeLessThan(settled.z - 2)
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
