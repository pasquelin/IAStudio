// SPDX-License-Identifier: MIT

import { beforeAll, describe, expect, it } from 'vitest'
import { CHECKER_TEXTURE_IDS } from '@shared/domain/checkerTexture'
import { TILES_PER_METRE } from '@shared/domain/scene'
import type { CsgPart } from '@shared/domain/csg'
import { airfieldNodes } from './airfieldLevel'
import { rememberCheckerTextures } from './checkerTextures'
import { circuitNodes } from './circuitLevel'
import { LEAST_TILES, WIDE_SURFACE, WIDE_SURFACE_TILE } from './levelParts'
import { mountainNodes } from './mountainLevel'
import type { SceneNode } from './sceneState'

/** What a surface draws, and at what density — the two halves of « wearing a grid ». */
type Drawn = { name: string; map: boolean; span: number; tilesPerMetre: number }

const OPEN_PROJECT = CHECKER_TEXTURE_IDS.map(id => ({ id, assetId: `asset-${id}` }))

/** How far a shape reaches, in metres, on its longest axis. */
function spanOfShape(shape: CsgPart['geometry']): number {
  // A brush may itself be a recipe: what one reads the grid on is then its largest PIECE.
  if (!('kind' in shape)) {
    return Math.max(
      ...[shape.base, ...shape.steps.map(step => step.part)].map(part =>
        spanOfShape(part.geometry),
      ),
    )
  }
  if (shape.kind === 'box') return Math.max(shape.width, shape.height, shape.depth)
  if (shape.kind === 'plane') return Math.max(shape.width, shape.height)
  if (shape.kind === 'cylinder') {
    return Math.max(shape.radiusTop * 2, shape.radiusBottom * 2, shape.height)
  }
  if (shape.kind === 'sphere') return shape.radius * 2
  return 1
}

function drawnOf(nodes: readonly SceneNode[]): Drawn[] {
  return nodes.flatMap(node => {
    if (node.type === 'mesh') {
      return [
        {
          name: node.name,
          map: node.material.map !== null,
          span: spanOfShape(node.geometry),
          tilesPerMetre: node.material.tilesPerMetre,
        },
      ]
    }
    if (node.type !== 'carved') return []
    // 🛑 One row per BRUSH: a solid's grid is written into its UVs from each brush's own density,
    // and the node's material settles the colour and the maps alone — see `brushOf`.
    return [node.carved.base, ...node.carved.steps.map(step => step.part)].map(part => ({
      name: `${node.name} · ${part.name}`,
      map: node.material.map !== null,
      span: spanOfShape(part.geometry),
      tilesPerMetre: part.material.tilesPerMetre,
    }))
  })
}

const LEVELS: [string, () => readonly SceneNode[]][] = [
  ['circuit', circuitNodes],
  ['mountain', mountainNodes],
  ['airfield', airfieldNodes],
]

describe('every surface a built level lays', () => {
  beforeAll(() => rememberCheckerTextures(OPEN_PROJECT))

  // 🛑 Reading a document CLAMPS the density (`revivedMaterial`), so a level written outside the
  // bounds looks one way when created and another once saved and reopened, with nothing said.
  it.each(LEVELS)('states a density a reopened document keeps, on the %s', (_level, build) => {
    const clamped = drawnOf(build()).filter(
      one => one.tilesPerMetre < TILES_PER_METRE.min || one.tilesPerMetre > TILES_PER_METRE.max,
    )

    expect(clamped.map(one => `${one.name} @ ${one.tilesPerMetre}/m`)).toEqual([])
  })

  // 🛑 What this refuses is a descriptor written by hand — `map: null`. `surface` itself cannot
  // produce one, so nothing else in the suite would catch it.
  it.each(LEVELS)('wears a working texture, all through the %s', (_level, build) => {
    const bare = drawnOf(build()).filter(one => !one.map)

    expect(bare.map(one => one.name)).toEqual([])
  })

  // 🛑 Measured both ways on this lot: one square stretched over a 32 m kerb reads as a flat
  // colour, and 340 squares over a 340 m field as a shimmer.
  it.each(LEVELS)('shows squares one can count, all through the %s', (_level, build) => {
    const unreadable = drawnOf(build()).filter(
      one =>
        one.span * one.tilesPerMetre < LEAST_TILES ||
        (one.span > WIDE_SURFACE && one.tilesPerMetre > 1 / WIDE_SURFACE_TILE),
    )

    expect(
      unreadable.map(one => `${one.name} @ ${one.tilesPerMetre}/m over ${one.span} m`),
    ).toEqual([])
  })
})
