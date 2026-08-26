// SPDX-License-Identifier: MIT

import type { Component } from '@shared/domain/component'
import type { Entity } from '../entity'
import type { System, World } from '../world'

/**
 * What makes an object travel on its own — a platform, a lift, a hazard.
 *
 * Where it started is remembered per entity rather than written into the component: the component
 * is the AUTHOR's setting, and a system writing a moving value into it would put the object's
 * live position in the document, where a ⌘S would save it and a STOP would not give it back.
 */
export function createMovementSystem(): System {
  const origins = new Map<string, number>()
  const travelled = new Map<string, number>()

  return {
    name: 'movement',
    reads: ['Movement'],
    writes: [],

    fixedUpdate: (world: World, dt: number) => {
      for (const entity of world.entities.withComponent('Movement')) {
        const held = entity.components.find(component => component.type === 'Movement')
        if (held) move(entity, held, dt, origins, travelled)
      }
    },
  }
}

const axisOf = (component: Component): 'x' | 'y' | 'z' => {
  const axis = component.axis
  return axis === 'x' || axis === 'z' ? axis : 'y'
}

const numberOf = (component: Component, key: string, fallback: number): number => {
  const value = component[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function move(
  entity: Entity,
  component: Component,
  dt: number,
  origins: Map<string, number>,
  travelled: Map<string, number>,
): void {
  const axis = axisOf(component)
  const distance = numberOf(component, 'distance', 0)
  const speed = numberOf(component, 'speed', 0)
  if (distance <= 0 || speed <= 0) return

  const origin = origins.get(entity.id) ?? entity.transform.position[axis]
  origins.set(entity.id, origin)

  const gone = (travelled.get(entity.id) ?? 0) + speed * dt
  const mode = component.mode
  // `once` stops at the far end; the two others fold the distance back, one by wrapping and one
  // by walking the way it came.
  const done = mode === 'once' ? Math.min(gone, distance) : gone
  travelled.set(entity.id, done)

  entity.transform.position[axis] = origin + offsetOf(done, distance, mode)
}

function offsetOf(gone: number, distance: number, mode: unknown): number {
  if (mode === 'once') return gone
  const laps = gone / distance
  if (mode === 'loop') return (laps % 1) * distance

  // pingPong, and the default: the second half of each lap walks back.
  const half = laps % 2
  return (half <= 1 ? half : 2 - half) * distance
}
