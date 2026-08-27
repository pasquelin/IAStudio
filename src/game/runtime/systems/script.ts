// SPDX-License-Identifier: MIT

import type { Component, JsonValue } from '@shared/domain/component'
import type { GameEvent } from '@shared/domain/gameEvent'
import type { ScriptModule } from '../../ports/scriptPort'
import type {
  ScriptEntity,
  ScriptFault,
  ScriptFrame,
  ScriptIntent,
  ScriptOutcome,
} from '../../script/frame'
import { textOf } from '../componentFields'
import { componentOf, type Entity } from '../entity'
import type { System, World } from '../world'

export type ScriptSystemOptions = {
  /** Already transpiled by the studio: the sandbox runs JavaScript, an author writes TypeScript. */
  modules: readonly ScriptModule[]
  /** Told what went wrong, with the script and the entity it belongs to. */
  onFault: (fault: ScriptFault) => void
}

/** 🛑 A script never touches the world: it is handed a COPY — see `ScriptIntent` for why. */
export function createScriptSystem(options: ScriptSystemOptions): System {
  const known = new Set<string>()
  const seen = new Set<string>()
  const fresh: { entity: string; script: string; props: Record<string, JsonValue> }[] = []
  const freshIds = new Set<string>()
  const gone: ScriptEntity[] = []
  const pool: ScriptEntity[] = []
  // 🛑 Kept ONLY while a script declares `onDestroy`: by the time the system notices a death, the
  // entity has left the store, and its last position is the one thing the hook cannot ask for.
  const closing = new Map<string, ScriptEntity>()
  const entities: ScriptEntity[] = []
  const frame: ScriptFrame = {
    tick: 0,
    dt: 0,
    input: { held: [], pressed: [], released: [], pointer: { x: 0, y: 0, down: false } },
    entities,
  }
  const waiting: GameEvent[] = []
  // Read once, on the first step, and let go of afterwards: it is the JavaScript of every script
  // of the project, and the system would otherwise hold it for the whole session.
  let modules: readonly ScriptModule[] | null = options.modules
  const onFault = options.onFault

  const took = (world: World, outcome: ScriptOutcome): void => {
    apply(world, outcome.intents)
    for (const fault of outcome.faults) onFault(fault)
  }

  /** Every scripted entity as the sandbox sees it, rebuilt in place rather than allocated. */
  const compose = (world: World, dt: number, only?: ReadonlySet<string>): ScriptFrame => {
    entities.length = 0
    for (const entity of world.entities.withComponent('Script')) {
      if (!known.has(entity.id)) continue
      if (only && !only.has(entity.id)) continue

      let held = pool[entities.length]
      if (!held) {
        held = {
          entity: '',
          name: '',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          components: [],
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

  const remember = (entity: Entity): void => {
    let held = closing.get(entity.id)
    if (!held) {
      held = { entity: entity.id, name: '', position: ZERO(), rotation: ZERO(), components: [] }
      closing.set(entity.id, held)
    }
    held.name = entity.name
    held.position = entity.transform.position
    held.rotation = entity.transform.rotation
    held.components = entity.components
  }

  const sync = (world: World): void => {
    const port = world.ports.script
    const remembering = port.declares('onDestroy')
    seen.clear()
    fresh.length = 0
    freshIds.clear()
    gone.length = 0

    for (const entity of world.entities.withComponent('Script')) {
      seen.add(entity.id)
      if (remembering) remember(entity)
      if (known.has(entity.id)) continue

      // Added only once it NAMES one: a `Script` component dropped and not yet filled in would
      // otherwise be serialized into every frame and handed to `detach` on its way out.
      const script = textOf(componentOf(entity, 'Script'), 'script', '')
      if (script.length === 0) continue
      known.add(entity.id)
      fresh.push({ entity: entity.id, script, props: {} })
      freshIds.add(entity.id)
    }

    for (const name of known) {
      if (seen.has(name)) continue
      gone.push(
        closing.get(name) ?? {
          entity: name,
          name: '',
          position: ZERO(),
          rotation: ZERO(),
          components: [],
        },
      )
    }
    for (const one of gone) {
      known.delete(one.entity)
      closing.delete(one.entity)
    }

    if (gone.length > 0) took(world, port.detach(gone))
    if (fresh.length > 0) {
      for (const fault of port.attach(fresh)) onFault(fault)
      // Composed over `freshIds` alone: the ones that were already running have had their turn.
      if (port.declares('onCreate')) took(world, port.run('onCreate', compose(world, 0, freshIds)))
      // A newcomer may be the first to declare `onDestroy` — its own position is not lost.
      if (port.declares('onDestroy'))
        for (const entity of world.entities.withComponent('Script')) remember(entity)
    }
  }

  return {
    name: 'script',
    reads: ['Script'],
    writes: [],

    fixedUpdate: (world: World, dt: number) => {
      const port = world.ports.script
      if (modules) {
        port.seed(world.random.state())
        for (const fault of port.load(modules)) onFault(fault)
        modules = null
        // Never dropped by hand: STOP clears the bus whole, which takes this with it.
        world.events.onAny(event => waiting.push(event))
      }

      sync(world)

      // Between two steps, never during one — a handler that spawned mid-sweep would walk what it
      // had just made. Emptied whether or not anyone listens, or a scriptless world hoards them.
      if (waiting.length > 0) {
        if (known.size > 0 && EVENT_HOOKS.some(hook => port.declares(hook)))
          took(world, port.deliver(compose(world, dt), waiting))
        waiting.length = 0
      }
      if (known.size === 0) return

      // `onStart` on the first step and `onUpdate` on the same one: an author who wrote both
      // means « once everything exists, then every step », not « one step later ».
      const opening = world.time.tick === 0 && port.declares('onStart')
      const stepping = port.declares('onUpdate')
      if (!opening && !stepping) return

      const composed = compose(world, dt)
      if (opening) took(world, port.run('onStart', composed))
      if (stepping) took(world, port.run('onUpdate', composed))
    },

    lateUpdate: (world: World) => {
      const port = world.ports.script
      if (modules) return
      if (known.size > 0 && port.declares('onLateUpdate'))
        took(world, port.run('onLateUpdate', compose(world, world.time.step)))
      // Last word of the rendered frame: what the next one spends is a whole budget again.
      port.refill()
    },
  }
}

/** What an event drives. A frame with none of them declared never crosses the bridge at all. */
const EVENT_HOOKS = ['onMessage', 'onCollision', 'onTriggerEnter', 'onTriggerExit']

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
        entity: intent.entity ?? undefined,
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
 * 🛑 One field the component ALREADY carries. `newComponent` fills every declared field, so a key
 * that is not there is one nobody declared — it would enter the document and never leave.
 */
function write(world: World, entity: Entity, type: string, key: string, value: JsonValue): void {
  for (const held of entity.components) {
    if (held.type !== type) continue
    if (key === 'type' || !(key in held)) return
    const next: Component = { ...held, [key]: value, type: held.type }
    // Through the WORLD, which defers to the end of the step — `entityStore` writes at once, and
    // a system must not add to an index it is walking.
    world.attach(entity, next)
    return
  }
}

const placed = (at: { x: number; y: number; z: number } | null) =>
  at ? { position: { ...at }, rotation: ZERO(), scale: { x: 1, y: 1, z: 1 } } : undefined

const ZERO = () => ({ x: 0, y: 0, z: 0 })
