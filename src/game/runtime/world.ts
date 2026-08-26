// SPDX-License-Identifier: MIT

import type { Component, ComponentType } from '@shared/domain/component'
import type { Ref } from '@shared/domain/ref'
import type { Transform } from '@shared/domain/transform'
import type { GameApi } from '../api/gameApi'
import { createEventBus, type EventBus } from '../events/eventBus'
import type { InputState } from '../ports/inputPort'
import { restingTransform, type Entity } from './entity'
import { createEntityStore, type EntityStore } from './entityStore'
import { createRandom, type Random } from './random'
import { orderedByDeclaration, writeConflicts, type SystemShape } from './systemOrder'

export type System = SystemShape & {
  fixedUpdate?: (world: World, dt: number) => void
  lateUpdate?: (world: World, alpha: number) => void
}

/**
 * 🛑 The world is MUTABLE and holds no reference to the document store — not by convention, by
 * absence of a path. That is what makes Play Mode safe: the runtime cannot write into the edit
 * state, so stopping restores nothing because nothing was touched.
 */
export type World = {
  readonly scene: Ref
  readonly entities: EntityStore
  readonly systems: readonly System[]
  readonly events: EventBus
  readonly random: Random
  readonly ports: GameApi
  /** The clock, in TICKS first: a tick is the unit the network counts in. */
  readonly time: { tick: number; elapsed: number; readonly step: number }
  /** The input as of the step being run — DATA of the tick, never a live read. */
  input: InputState
  /**
   * The four gestures a SYSTEM uses, all of them landing at the END of the step.
   *
   * 🛑 A `Set` visits what is added to it while it is being walked, so a system spawning — or
   * attaching what it sweeps for — would walk what it just made, for ever. The editor writes
   * through `entities` directly; a system never does.
   */
  spawn: (request: {
    name: string
    transform?: Transform
    components?: readonly Component[]
  }) => Entity
  destroy: (id: string) => void
  attach: (entity: Entity, component: Component) => void
  detach: (entity: Entity, type: ComponentType) => void
  /** One fixed step: input snapshot, systems in order, births and deaths, then the events. */
  step: (dt: number) => void
  lateUpdate: (alpha: number) => void
}

export type WorldOptions = {
  scene: Ref
  ports: GameApi
  systems: readonly System[]
  /** Same seed, same world — what a replay, a test and network prediction all rest on. */
  seed: number
  step: number
}

export function createWorld(options: WorldOptions): World {
  const systems = orderedByDeclaration(options.systems)
  const born: Entity[] = []
  const doomed: string[] = []
  const attaching: { entity: Entity; component: Component }[] = []
  const detaching: { entity: Entity; type: ComponentType }[] = []
  let minted = 0

  const said = (error: unknown): string => (error instanceof Error ? error.message : String(error))

  const world: World = {
    scene: options.scene,
    entities: createEntityStore(),
    systems,
    events: createEventBus((error, event) =>
      options.ports.log.write('error', `handler of ${event.name} threw: ${said(error)}`),
    ),
    random: createRandom(options.seed),
    ports: options.ports,
    time: { tick: 0, elapsed: 0, step: options.step },
    input: options.ports.input.state(),

    spawn: request => {
      // Counted rather than drawn from `crypto.randomUUID`: two runs of one seed must mint the
      // same identifiers. Taken ones are stepped over, so a world restored from a save cannot
      // mint an identifier it already carries.
      do minted += 1
      while (world.entities.get(`spawn_${minted}`) !== null)

      const entity: Entity = {
        id: `spawn_${minted}`,
        name: request.name,
        transform: request.transform ?? restingTransform(),
        components: [...(request.components ?? [])],
      }
      born.push(entity)
      world.events.emit({ name: 'EntitySpawned', entity: entity.id, payload: {} })
      return entity
    },

    destroy: id => {
      // A death announced for an entity that never lived is a handler acting on nothing. Killing
      // one twice says so once.
      const lives = world.entities.get(id) !== null || born.some(one => one.id === id)
      if (!lives || doomed.includes(id)) return

      doomed.push(id)
      world.events.emit({ name: 'EntityDestroyed', entity: id, payload: {} })
    },

    attach: (entity, component) => {
      attaching.push({ entity, component })
    },

    detach: (entity, type) => {
      detaching.push({ entity, type })
    },

    step: dt => {
      world.input = world.ports.input.state()

      for (let index = 0; index < systems.length; index++) {
        const system = systems[index]
        if (!system?.fixedUpdate) continue
        try {
          system.fixedUpdate(world, dt)
        } catch (error) {
          // Reported rather than thrown on: a throw here would skip `endStep` and the tick, so
          // the same frame would be retried and would throw again, for ever.
          world.ports.log.write('error', `system ${system.name} threw: ${said(error)}`)
        }
      }

      for (let index = 0; index < born.length; index++) {
        const entity = born[index]
        if (entity) world.entities.add(entity)
      }
      born.length = 0

      for (let index = 0; index < attaching.length; index++) {
        const wanted = attaching[index]
        if (wanted) world.entities.attach(wanted.entity, wanted.component)
      }
      attaching.length = 0

      for (let index = 0; index < detaching.length; index++) {
        const wanted = detaching[index]
        if (wanted) world.entities.detach(wanted.entity, wanted.type)
      }
      detaching.length = 0

      for (let index = 0; index < doomed.length; index++) {
        const id = doomed[index]
        if (id !== undefined) world.entities.remove(id)
      }
      doomed.length = 0

      world.events.drain()
      world.ports.input.endStep()

      world.time.tick += 1
      world.time.elapsed += dt
    },

    lateUpdate: alpha => {
      for (let index = 0; index < systems.length; index++) {
        const system = systems[index]
        if (!system?.lateUpdate) continue
        try {
          system.lateUpdate(world, alpha)
        } catch (error) {
          world.ports.log.write('error', `system ${system.name} threw: ${said(error)}`)
        }
      }
    },
  }

  // Said once, at build time: which system owns a component is not a thing a running step can
  // work out, and two writers means the winner is whichever order happened to be declared.
  for (const type of writeConflicts(systems)) {
    world.ports.log.write('warn', `two systems write ${type}`)
  }

  return world
}
