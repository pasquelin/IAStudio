// SPDX-License-Identifier: MIT

import { bench, describe } from 'vitest'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import type { BodyDescriptor, PhysicsPort } from '../ports/physicsPort'
import { loadRapierPhysics } from './rapierPhysics'

/**
 * What a frame of physics costs, replayed rather than taken on trust from the lot 0 spike.
 *
 * The budget is 16,7 ms and the spike of 2026-08-26 read 0,85 ms for 500 AWAKE stacked bodies.
 *
 * 🛑 Awake is the worst case, not the average, and a bench is where the two get confused: a pile
 * left alone SETTLES within a few steps, and every iteration after that measures a sleeping
 * scene. The floor under the awake benches is kinematic and jiggled once per iteration, which is
 * what keeps the pile in contact and in motion for the whole run.
 *
 * The character controller is measured on its own — it was what elected Rapier over Jolt.
 *
 * Measured 2026-08-27 on this Mac, through the port rather than against the raw engine: **500
 * awake bodies 1,06 ms** (p99 1,31), 1 000 awake 2,06 ms, **500 SETTLED bodies 0,0019 ms**, and a
 * walking character 0,0041 ms. Awake is above the spike's 0,85 because the pile here stays in
 * contact with a floor that moves and the figure includes reading every pose back; settled is a
 * five-hundredth of it because `poses` walks the active island alone.
 */
const STEP = 1 / 60

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
  ...over,
})

/** A grid of crates dropped just above the floor, so the pile is still moving when it is timed. */
async function stacked(count: number): Promise<PhysicsPort> {
  const port = await loadRapierPhysics()
  port.setGravity(-9.81)

  const bodies: BodyDescriptor[] = [
    body({
      body: 'floor',
      kind: 'kinematic',
      shape: { kind: 'cuboid', hx: 60, hy: 0.5, hz: 60 },
      transform: { ...IDENTITY_TRANSFORM, position: { x: 0, y: -0.5, z: 0 } },
    }),
  ]
  const side = Math.ceil(Math.sqrt(count))
  for (let index = 0; index < count; index++) {
    bodies.push(
      body({
        body: `crate${index}`,
        shape: { kind: 'cuboid', hx: 0.5, hy: 0.5, hz: 0.5 },
        transform: {
          ...IDENTITY_TRANSFORM,
          position: { x: (index % side) * 1.1, y: 2 + Math.floor(index / side) * 1.1, z: 0 },
        },
      }),
    )
  }

  port.add(bodies)
  return port
}

async function walking(): Promise<PhysicsPort> {
  const port = await loadRapierPhysics()
  port.setGravity(-9.81)
  port.add([
    body({
      body: 'floor',
      kind: 'fixed',
      shape: { kind: 'cuboid', hx: 60, hy: 0.5, hz: 60 },
      transform: { ...IDENTITY_TRANSFORM, position: { x: 0, y: -0.5, z: 0 } },
    }),
    body({
      body: 'walker',
      kind: 'kinematic',
      shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.3 },
      transform: { ...IDENTITY_TRANSFORM, position: { x: 0, y: 0.9, z: 0 } },
      character: { stepHeight: 0.5, slopeLimit: 45, snapDistance: 0.5 },
    }),
  ])
  return port
}

/** Enough to keep every contact live, and far too little to move the pile anywhere. */
function jiggle(port: PhysicsPort, at: number): void {
  port.place([
    {
      body: 'floor',
      position: { x: 0, y: -0.5 + Math.sin(at) * 0.002, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
  ])
}

describe('one step of physics', async () => {
  const five = await stacked(500)
  const one = await stacked(1000)
  const settled = await stacked(500)
  const walker = await walking()
  let at = 0

  // Left alone until the pile sleeps, which is what a scene spends most of its time doing.
  for (let step = 0; step < 600; step++) settled.step(STEP)

  bench('500 bodies, awake', () => {
    jiggle(five, (at += 1))
    five.step(STEP)
    five.poses()
  })

  bench('1 000 bodies, awake', () => {
    jiggle(one, (at += 1))
    one.step(STEP)
    one.poses()
  })

  bench('500 bodies, settled', () => {
    settled.step(STEP)
    settled.poses()
  })

  bench('a character walking, floor and controller', () => {
    walker.moveCharacters([{ body: 'walker', wanted: { x: 0.05, y: -0.02, z: 0 } }])
    walker.step(STEP)
    walker.poses()
  })
})
