// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { CsgPart } from '@shared/domain/csg'
import type { SceneNode } from './sceneState'
import { CIRCUIT_START, circuitNodes } from './circuitLevel'

const named = (nodes: readonly SceneNode[], word: string): SceneNode[] =>
  nodes.filter(node => node.name.startsWith(word))

/** The brushes one solid was welded out of — where a track's geometry is now written. */
function brushesOf(nodes: readonly SceneNode[], name: string): CsgPart[] {
  const solid = nodes.find(node => node.name === name)
  if (solid?.type !== 'carved') return []
  return [solid.carved.base, ...solid.carved.steps.map(step => step.part)]
}

/** How far a point sits ALONG a brush's own long axis. */
function alongAxis(part: CsgPart, x: number, z: number): number {
  const yaw = part.transform.rotation.y
  return Math.abs(
    (x - part.transform.position.x) * Math.sin(yaw) +
      (z - part.transform.position.z) * Math.cos(yaw),
  )
}

/** How far a point sits off a brush's own long axis — what tells the track from beside it. */
function offAxis(part: CsgPart, x: number, z: number): number {
  const yaw = part.transform.rotation.y
  const dx = x - part.transform.position.x
  const dz = z - part.transform.position.z
  // The component ACROSS the brush, in its own frame. Along it is the length, which does not matter.
  return Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw))
}

const boxOf = (part: CsgPart): { width: number; depth: number } =>
  'kind' in part.geometry && part.geometry.kind === 'box'
    ? { width: part.geometry.width, depth: part.geometry.depth }
    : { width: 0, depth: 0 }

describe('the circuit a car opens on', () => {
  const nodes = circuitNodes()
  const tarmac = brushesOf(nodes, 'Tarmac')
  const kerbs = [...brushesOf(nodes, 'Kerb Left'), ...brushesOf(nodes, 'Kerb Right')]

  /** A car put beside its own track spends the first corner climbing back onto it. */
  it('puts the car down on the tarmac rather than beside it', () => {
    const nearest = Math.min(...tarmac.map(part => offAxis(part, CIRCUIT_START.x, CIRCUIT_START.z)))

    // Half the track width: dead centre is 0, and the kerbs start at 6.
    expect(nearest).toBeLessThan(6)
  })

  // 🛑 A car put down INSIDE a fixed body is catapulted by the first step — 1500 kg resolving an
  // interpenetration, with no key ever pressed.
  it('starts the car clear of every kerb', () => {
    const touched = kerbs.filter(part => {
      const box = boxOf(part)
      // Half a car is 0,9 m across and 2 m long: the margin a nose needs to be clear.
      return (
        offAxis(part, CIRCUIT_START.x, CIRCUIT_START.z) < box.width / 2 + 0.9 &&
        alongAxis(part, CIRCUIT_START.x, CIRCUIT_START.z) < box.depth / 2 + 2
      )
    })

    expect(touched.map(part => part.name)).toEqual([])
  })

  // 🛑 A second floor laid over the scene's own ground is a lip the front wheels catch at every
  // joint, so only the kerbs are felt.
  it('makes the kerbs solid and leaves the tarmac decor', () => {
    const felt = (node: SceneNode): boolean =>
      (node.components ?? []).some(one => one.type === 'RigidBody')

    expect(named(nodes, 'Kerb').map(node => node.name)).toEqual(['Kerb Left', 'Kerb Right'])
    expect(named(nodes, 'Kerb').every(felt)).toBe(true)
    expect(named(nodes, 'Tarmac').some(felt)).toBe(false)
  })

  // 🛑 One mesh is one draw call: the loop was twenty-four slabs and forty-eight kerb blocks.
  it('draws the whole circuit in a handful of meshes', () => {
    const drawn = nodes.filter(node => node.type === 'mesh' || node.type === 'carved')

    expect(drawn.map(node => node.name).sort()).toEqual([
      'Grass',
      'Kerb Left',
      'Kerb Right',
      'Paddock',
      'Posts',
      'Start Line',
      'Tarmac',
    ])
  })

  // 🛑 Continuous and closed, the seam included: stretching a leg by the track's own width made
  // a 5,6 m chord into a 17,6 m box, piling the inner kerbs across the corner they bordered.
  it('leaves no hole anywhere around the loop, the seam included', () => {
    const holes = tarmac.map((part, index) => {
      const next = tarmac[(index + 1) % tarmac.length]!
      const tip = (one: CsgPart, sign: number) => ({
        x:
          one.transform.position.x +
          (Math.sin(one.transform.rotation.y) * sign * boxOf(one).depth) / 2,
        z:
          one.transform.position.z +
          (Math.cos(one.transform.rotation.y) * sign * boxOf(one).depth) / 2,
      })
      const end = tip(part, 1)
      const start = tip(next, -1)
      const yaw = next.transform.rotation.y
      // Along the NEXT leg: positive is overlap, negative is a gap.
      return (end.x - start.x) * Math.sin(yaw) + (end.z - start.z) * Math.cos(yaw)
    })

    expect(Math.min(...holes)).toBeGreaterThanOrEqual(0)
  })

  // 🛑 The scenery is DECOR: a hedge is not where a lap is decided, so only the kerbs stop.
  it('leaves everything around the track free of collision', () => {
    const felt = nodes.filter(
      node =>
        !node.name.startsWith('Kerb') &&
        (node.components ?? []).some(one => one.type === 'RigidBody'),
    )

    expect(felt.map(node => node.name)).toEqual([])
  })

  // 🛑 The paddock stood 6,00 m from the centre line — the edge of the tarmac — and covered
  // nineteen metres of corner. The posts are read one BRUSH at a time: welded into a ring, the
  // solid's own centre is the middle of the circuit, and no post is there.
  it('keeps every piece of scenery off the tarmac', () => {
    const scenery: { name: string; x: number; z: number; reach: number }[] = [
      ...nodes
        .filter(node => node.type === 'mesh' && node.geometry.kind === 'box')
        .filter(node => node.name !== 'Start Line')
        .map(node => ({
          name: node.name,
          x: node.transform.position.x,
          z: node.transform.position.z,
          reach:
            node.type === 'mesh' && node.geometry.kind === 'box'
              ? Math.max(node.geometry.width, node.geometry.depth) / 2
              : 0,
        })),
      ...brushesOf(nodes, 'Posts').map(part => ({
        name: part.name,
        x: part.transform.position.x,
        z: part.transform.position.z,
        reach:
          'kind' in part.geometry && part.geometry.kind === 'cylinder'
            ? part.geometry.radiusBottom
            : 0,
      })),
    ]

    const trespassing = scenery.filter(piece =>
      tarmac.some(
        slab =>
          offAxis(slab, piece.x, piece.z) < 6 + piece.reach &&
          alongAxis(slab, piece.x, piece.z) < boxOf(slab).depth / 2 + piece.reach,
      ),
    )

    expect(trespassing.map(piece => piece.name)).toEqual([])
  })

  // 🛑 The test that was missing, and it cost a whole track: a loop whose legs CROSS puts its
  // kerbs across the tarmac they border. Neighbours are skipped — they touch by design.
  it('never crosses itself', () => {
    const span = (part: CsgPart) => {
      const half = boxOf(part).depth / 2
      const dx = Math.sin(part.transform.rotation.y) * half
      const dz = Math.cos(part.transform.rotation.y) * half
      return {
        ax: part.transform.position.x - dx,
        az: part.transform.position.z - dz,
        bx: part.transform.position.x + dx,
        bz: part.transform.position.z + dz,
      }
    }

    const crossings: string[] = []
    for (let one = 0; one < tarmac.length; one++) {
      for (let other = one + 2; other < tarmac.length; other++) {
        // The first and last legs are neighbours too — the loop closes between them.
        if (one === 0 && other === tarmac.length - 1) continue
        if (crosses(span(tarmac[one]!), span(tarmac[other]!))) {
          crossings.push(`${one + 1}x${other + 1}`)
        }
      }
    }

    expect(crossings).toEqual([])
  })
})

/** Whether two segments meet anywhere but at their ends — the sign of the cross products. */
function crosses(
  one: { ax: number; az: number; bx: number; bz: number },
  other: { ax: number; az: number; bx: number; bz: number },
): boolean {
  const side = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number): number =>
    Math.sign((qx - px) * (rz - pz) - (qz - pz) * (rx - px))

  const first = side(one.ax, one.az, one.bx, one.bz, other.ax, other.az)
  const second = side(one.ax, one.az, one.bx, one.bz, other.bx, other.bz)
  const third = side(other.ax, other.az, other.bx, other.bz, one.ax, one.az)
  const fourth = side(other.ax, other.az, other.bx, other.bz, one.bx, one.bz)
  return first !== second && third !== fourth
}
