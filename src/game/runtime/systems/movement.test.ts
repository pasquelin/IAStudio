// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { Component } from '@shared/domain/component'
import { restingTransform } from '../entity'
import { STEP_SECONDS } from '../gameLoop'
import { createMovementSystem } from './movement'
import { testWorld } from '../world-fixtures'
import type { World } from '../world'

const mover = (over: Partial<Component> = {}): Component => ({
  type: 'Movement',
  axis: 'y',
  speed: 1,
  distance: 2,
  mode: 'pingPong',
  ...over,
})

const playing = (component: Component): World => {
  const world = testWorld({ systems: [createMovementSystem()] })
  world.entities.add({ id: 'a', name: 'a', transform: restingTransform(), components: [component] })
  return world
}

const heightAfter = (world: World, steps: number): number => {
  for (let step = 0; step < steps; step++) world.step(STEP_SECONDS)
  return world.entities.get('a')?.transform.position.y ?? Number.NaN
}

describe('what makes an object travel on its own', () => {
  it('walks out and back, never past the distance it was given', () => {
    const world = playing(mover())
    const heights = Array.from({ length: 240 }, () => heightAfter(world, 1))

    expect(Math.max(...heights)).toBeLessThanOrEqual(2)
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(0)
    // Two seconds at one unit a second is the far end; a second later it is on the way back.
    expect(heights[119] ?? 0).toBeCloseTo(2, 1)
    expect(heights[179] ?? 0).toBeLessThan(heights[119] ?? 0)
  })

  it('stops at the far end when it is asked to go once', () => {
    expect(heightAfter(playing(mover({ mode: 'once' })), 600)).toBeCloseTo(2, 6)
  })

  it('starts over rather than coming back when it is asked to loop', () => {
    const world = playing(mover({ mode: 'loop' }))

    expect(heightAfter(world, 119)).toBeCloseTo(2, 1)
    expect(heightAfter(world, 2)).toBeLessThan(0.1)
  })

  /** A setting of nothing is a component that draws no conclusion, not one that drifts. */
  it('leaves an object alone when it was given no distance or no speed', () => {
    expect(heightAfter(playing(mover({ distance: 0 })), 60)).toBe(0)
    expect(heightAfter(playing(mover({ speed: 0 })), 60)).toBe(0)
  })

  /**
   * Where it started is the system's own memory, never the component: writing a live position
   * into the component would put it in the document, where a ⌘S would save it.
   */
  it('leaves the component exactly as the author wrote it', () => {
    const world = playing(mover())
    heightAfter(world, 120)

    expect(world.entities.get('a')?.components).toEqual([mover()])
  })
})
