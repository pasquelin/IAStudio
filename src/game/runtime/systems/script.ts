// SPDX-License-Identifier: MIT

import type { Component, JsonValue } from '@shared/domain/component'
import type { GameEvent } from '@shared/domain/gameEvent'
import type { ScriptModule } from '../../ports/scriptPort'
import type { ScriptEntity, ScriptFault, ScriptFrame, ScriptIntent } from '../../script/frame'
import { textOf } from '../componentFields'
import { componentOf, restingTransform, type Entity } from '../entity'
import type { System, World } from '../world'

export type ScriptSystemOptions = {
  /** Already transpiled by the studio: the sandbox runs JavaScript, an author writes TypeScript. */
  modules: readonly ScriptModule[]
  /** Told what went wrong, with the script and the entity it belongs to. */
  onFault: (fault: ScriptFault) => void
}

/**
 * 🛑 A script never touches the world. It is handed a COPY of the frame, and what it asks for
 * comes back as intents this applies through the world's own gestures — which is what lets the
 * whole frame cross the bridge in ONE call, and what keeps a script from writing into a store
 * being walked.
 */
export function createScriptSystem(options: ScriptSystemOptions): System {
  const known = new Set<string>()
  const seen = new Set<string>()
  const fresh: { entity: string; script: string; props: Record<string, JsonValue> }[] = []
  const gone: string[] = []
  const pool: ScriptEntity[] = []
  const entities: ScriptEntity[] = []
  const frame: ScriptFrame = {
    tick: 0,
    dt: 0,
    input: { held: [], pressed: [], released: [], pointer: { x: 0, y: 0, down: false } },
    entities,
  }
  const waiting: GameEvent[] = []
  let started = false

  const report = (world: World, faults: readonly ScriptFault[]): void => {
    for (const fault of faults) {
      options.onFault(fault)
      world.ports.log.write('error', `${fault.script}:${fault.line} — ${fault.message}`)
    }
  }

  /** Every scripted entity as the sandbox sees it, rebuilt in place rather than allocated. */
  const compose = (world: World, dt: number): ScriptFrame => {
    entities.length = 0
    for (const entity of world.entities.withComponent('Script')) {
      if (!known.has(entity.id)) continue

      let held = pool[entities.length]
      if (!held) {
        held = {
          entity: '',
          name: '',
          position: restingTransform().position,
          rotation: restingTransform().rotation,
          components: [],
          props: {},
        }
        pool.push(held)
      }
      held.entity = entity.id
      held.name = entity.name
      held.position = entity.transform.position
      held.rotation = entity.transform.rotation
      held.components = entity.components
      entities.push(held)
    }

    frame.tick = world.time.tick
    frame.dt = dt
    frame.input = world.input
    return frame
  }

  const sync = (world: World): void => {
    seen.clear()
    fresh.length = 0
    gone.length = 0

    for (const entity of world.entities.withComponent('Script')) {
      seen.add(entity.id)
      if (known.has(entity.id)) continue

      const script = textOf(componentOf(entity, 'Script'), 'script', '')
      known.add(entity.id)
      if (script.length > 0) fresh.push({ entity: entity.id, script, props: {} })
    }

    for (const name of known) if (!seen.has(name)) gone.push(name)
    for (const name of gone) known.delete(name)

    if (gone.length > 0) {
      report(world, world.ports.script.run('onDestroy', compose(world, 0)).faults)
      world.ports.script.detach(gone)
    }
    if (fresh.length > 0) {
      report(world, world.ports.script.attach(fresh))
      // `onCreate` only for the ones that just joined — `compose` is walked over `known`.
      const outcome = world.ports.script.run('onCreate', compose(world, 0))
      apply(world, outcome.intents)
      report(world, outcome.faults)
    }
  }

  return {
    name: 'script',
    reads: ['Script'],
    writes: [],

    fixedUpdate: (world: World, dt: number) => {
      const port = world.ports.script
      if (!started) {
        started = true
        port.seed(world.random.state())
        report(world, port.load(options.modules))
        // Never dropped by hand: STOP clears the bus whole, which takes this with it.
        world.events.onAny(event => waiting.push(event))
      }

      sync(world)
      if (world.entities.count() === 0) return

      // Between two steps, never during one — a handler that spawned mid-sweep would walk what it
      // had just made.
      if (waiting.length > 0) {
        const outcome = port.deliver(compose(world, dt), waiting)
        waiting.length = 0
        apply(world, outcome.intents)
        report(world, outcome.faults)
      }

      // `onStart` on the first step and `onUpdate` on the same one: an author who wrote both
      // means « once everything exists, then every step », not « one step later ».
      if (world.time.tick === 0) {
        const opening = port.run('onStart', compose(world, dt))
        apply(world, opening.intents)
        report(world, opening.faults)
      }

      const outcome = port.run('onUpdate', compose(world, dt))
      apply(world, outcome.intents)
      report(world, outcome.faults)
    },

    lateUpdate: (world: World) => {
      if (!started) return
      const outcome = world.ports.script.run('onLateUpdate', compose(world, world.time.step))
      apply(world, outcome.intents)
      report(world, outcome.faults)
    },
  }
}

/** What the scripts asked for, done through the world's own gestures and nothing else. */
function apply(world: World, intents: readonly ScriptIntent[]): void {
  for (const intent of intents) {
    if (intent.act === 'log') {
      world.ports.log.write(intent.level, intent.message)
      continue
    }
    if (intent.act === 'spawn') {
      world.spawn({ name: intent.name, transform: placed(intent.at) })
      continue
    }
    if (intent.act === 'emit') {
      // 🛑 `Custom`, always, carrying the name the script chose as DATA: the closed union of
      // `GameEventName` is a value of `@shared/`, which this tree may not read.
      world.events.emit({
        name: 'Custom',
        ...(intent.entity ? { entity: intent.entity } : {}),
        payload: { ...intent.payload, name: intent.name },
      })
      continue
    }

    const entity = world.entities.get(intent.entity)
    if (!entity) continue

    if (intent.act === 'move') {
      entity.transform.position.x += intent.by.x
      entity.transform.position.y += intent.by.y
      entity.transform.position.z += intent.by.z
    } else if (intent.act === 'place') {
      entity.transform.position.x = intent.at.x
      entity.transform.position.y = intent.at.y
      entity.transform.position.z = intent.at.z
    } else if (intent.act === 'turn') {
      entity.transform.rotation.x = intent.to.x
      entity.transform.rotation.y = intent.to.y
      entity.transform.rotation.z = intent.to.z
    } else if (intent.act === 'field') {
      write(world, entity, intent.type, intent.key, intent.value)
    } else {
      world.destroy(intent.entity)
    }
  }
}

/**
 * One field of one component the entity ALREADY carries. Read off what it holds rather than off
 * the registry, which is a value of `@shared/`: a type nothing declared writes nothing, so a
 * script cannot invent a component the studio has no descriptor for.
 */
function write(world: World, entity: Entity, type: string, key: string, value: JsonValue): void {
  for (const held of entity.components) {
    if (held.type !== type || key === 'type') continue
    const next: Component = { ...held, [key]: value, type: held.type }
    world.entities.attach(entity, next)
    return
  }
}

const placed = (at: { x: number; y: number; z: number } | null) => {
  if (!at) return undefined
  const transform = restingTransform()
  transform.position = { ...at }
  return transform
}
