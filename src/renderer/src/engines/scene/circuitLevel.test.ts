// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { Vector3 } from '@shared/domain/scene'
import type { SceneNode } from './sceneState'
import { CIRCUIT_START, circuitLine, circuitNodes } from './circuitLevel'

const named = (nodes: readonly SceneNode[], word: string): SceneNode[] =>
  nodes.filter(node => node.name.startsWith(word))

/** The rail a band was swept along — where a track's geometry is written. */
function runOf(nodes: readonly SceneNode[], name: string): readonly Vector3[] {
  const band = nodes.find(node => node.name === name)
  return band?.type === 'mesh' && band.geometry.kind === 'ribbon' ? band.geometry.path.points : []
}

/** How far a point sits from a closed run — the distance to the nearest of its segments. */
function distanceToRun(run: readonly Vector3[], x: number, z: number): number {
  return Math.min(
    ...run.map((from, index) => {
      const to = run[(index + 1) % run.length]!
      const dx = to.x - from.x
      const dz = to.z - from.z
      const length = dx * dx + dz * dz
      const along =
        length === 0
          ? 0
          : Math.max(0, Math.min(1, ((x - from.x) * dx + (z - from.z) * dz) / length))
      return Math.hypot(x - (from.x + dx * along), z - (from.z + dz * along))
    }),
  )
}

describe('the circuit a car opens on', () => {
  const nodes = circuitNodes()
  const tarmac = runOf(nodes, 'Tarmac')

  /** A car put beside its own track spends the first corner climbing back onto it. */
  it('puts the car down on the tarmac rather than beside it', () => {
    // Half the track width: dead centre is 0, and the kerbs start at 6.
    expect(distanceToRun(tarmac, CIRCUIT_START.x, CIRCUIT_START.z)).toBeLessThan(6)
  })

  // 🛑 A car put down INSIDE a fixed body is catapulted by the first step — 1500 kg resolving an
  // interpenetration, with no key ever pressed.
  it('starts the car clear of every kerb', () => {
    const touched = ['Kerb Left', 'Kerb Right'].filter(name => {
      // Half a kerb is 0,5 m across and half a car 0,9: under that, the two overlap.
      return distanceToRun(runOf(nodes, name), CIRCUIT_START.x, CIRCUIT_START.z) < 1.4
    })

    expect(touched).toEqual([])
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

  /**
   * 🛑 A closed band is not convex, and its hull is the whole infield: felt as one, a car would
   * meet a wall the moment it left the grid.
   */
  it('has the kerbs felt as the bands they are', () => {
    const fidelities = named(nodes, 'Kerb').map(
      node => (node.components ?? []).find(one => one.type === 'Collider')?.fidelity,
    )

    expect(fidelities).toEqual(['trimesh', 'trimesh'])
  })

  /**
   * 🛑 The track is THREE meshes and no boolean: one band for the tarmac and one a side. It was
   * twenty-four slabs and forty-eight kerb blocks, welded — which kept every corner standing.
   */
  it('draws the track as one band a piece, and nothing carved', () => {
    const drawn = nodes.filter(node => node.type === 'mesh' || node.type === 'carved')
    const bands = drawn.filter(node => node.type === 'mesh' && node.geometry.kind === 'ribbon')

    expect(bands.map(node => node.name).sort()).toEqual(['Kerb Left', 'Kerb Right', 'Tarmac'])
    expect(drawn.filter(node => node.type === 'carved')).toEqual([])
  })

  /**
   * The kerbs run PARALLEL to the tarmac all the way round — the one thing a hand-placed kerb
   * never manages. Measured on the middle of each segment: a mitred point sits further out by
   * construction, and reading the points would measure the mitre rather than the gap.
   */
  it('keeps both kerbs parallel to the tarmac, all the way round', () => {
    for (const name of ['Kerb Left', 'Kerb Right']) {
      const run = runOf(nodes, name)
      const gaps = run.map((from, index) => {
        const to = run[(index + 1) % run.length]!
        return distanceToRun(tarmac, (from.x + to.x) / 2, (from.z + to.z) / 2)
      })

      // Half the track plus half a kerb, to the centimetre, on every segment of the loop.
      expect(Math.min(...gaps)).toBeGreaterThan(6.4)
      expect(Math.max(...gaps)).toBeLessThan(6.6)
    }
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
  // nineteen metres of corner.
  it('keeps every piece of scenery off the tarmac', () => {
    const trespassing = nodes.filter(node => {
      // Volumes only: the grass is the ground the whole circuit stands on, and a plane laid under
      // the tarmac is not scenery standing on it.
      if (node.type !== 'mesh') return false
      if (node.geometry.kind === 'ribbon' || node.geometry.kind === 'plane') return false
      if (node.name === 'Start Line') return false
      const shape = node.geometry
      const reach =
        shape.kind === 'box'
          ? Math.max(shape.width, shape.depth) / 2
          : shape.kind === 'cylinder'
            ? shape.radiusBottom
            : Math.max(...Object.values(shape).filter(one => typeof one === 'number')) / 2
      return distanceToRun(tarmac, node.transform.position.x, node.transform.position.z) < 6 + reach
    })

    expect(trespassing.map(node => node.name)).toEqual([])
  })

  /**
   * 🛑 The test that was missing, and it cost a whole track: a loop whose legs CROSS puts its
   * kerbs across the tarmac they border. Neighbours are skipped — they touch by design.
   */
  it('never crosses itself', () => {
    const run = circuitLine(0)
    const crossings: string[] = []

    for (let one = 0; one < run.length; one++) {
      for (let other = one + 2; other < run.length; other++) {
        if (one === 0 && other === run.length - 1) continue
        const a = { from: run[one]!, to: run[(one + 1) % run.length]! }
        const b = { from: run[other]!, to: run[(other + 1) % run.length]! }
        if (crosses(a, b)) crossings.push(`${one + 1}x${other + 1}`)
      }
    }

    expect(crossings).toEqual([])
  })
})

type Segment = { from: Vector3; to: Vector3 }

/** Whether two segments meet anywhere but at their ends — the sign of the cross products. */
function crosses(one: Segment, other: Segment): boolean {
  const side = (p: Vector3, q: Vector3, r: Vector3): number =>
    Math.sign((q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x))

  return (
    side(one.from, one.to, other.from) !== side(one.from, one.to, other.to) &&
    side(other.from, other.to, one.from) !== side(other.from, other.to, one.to)
  )
}
