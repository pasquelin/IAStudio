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
import { settingsOf, textOf } from '../componentFields'
import { componentOf, type Entity } from '../entity'
import { sayCustom } from '../sayCustom'
import type { System, World } from '../world'

export type ScriptSystemOptions = {
  /** Already transpiled by the studio: the sandbox runs JavaScript, an author writes TypeScript. */
  modules: readonly ScriptModule[]
  /** Told what went wrong, with the script and the entity it belongs to. */
  onFault: (fault: ScriptFault) => void
}

/** Shared and empty: a frame with nothing kept must not allocate an object per hook. */
const NOTHING_KEPT: Readonly<Record<string, JsonValue>> = Object.freeze({})

/** An entity as the sandbox hears of one it can no longer see: a name, and nowhere to be. */
const blank = (entity: string): ScriptEntity => ({
  entity,
  name: '',
  position: ZERO(),
  rotation: ZERO(),
  components: [],
})

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
    kept: {},
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
    // Only when there IS something kept: the frame is serialized whole for every hook of every
    // step, and an inventory put aside at the menu would be paid for twice a step for ever.
    const kept = world.ports.scenes.kept()
    frame.kept = Object.keys(kept).length > 0 ? kept : NOTHING_KEPT
    return frame
  }

  const remember = (entity: Entity): void => {
    let held = closing.get(entity.id)
    if (!held) {
      held = blank(entity.id)
      closing.set(entity.id, held)
    }
    held.name = entity.name
    held.position = entity.transform.position
    held.rotation = entity.transform.rotation
    held.components = entity.components
  }

  const discover = (world: World, remembering: boolean): void => {
    for (const entity of world.entities.withComponent('Script')) {
      seen.add(entity.id)
      if (remembering) remember(entity)
      if (known.has(entity.id)) continue
      const held = componentOf(entity, 'Script')
      const script = textOf(held, 'script', '')
      if (script.length === 0) continue
      known.add(entity.id)
      fresh.push({ entity: entity.id, script, props: settingsOf(held, 'props') })
      freshIds.add(entity.id)
    }
  }

  const collectGone = (): void => {
    for (const name of known) {
      if (!seen.has(name)) gone.push(closing.get(name) ?? blank(name))
    }
    for (const one of gone) {
      known.delete(one.entity)
      closing.delete(one.entity)
    }
  }

  const sync = (world: World): void => {
    const port = world.ports.script
    const remembering = port.declares('onDestroy')
    seen.clear()
    fresh.length = 0
    freshIds.clear()
    gone.length = 0

    discover(world, remembering)
    collectGone()
    if (gone.length > 0) took(world, port.detach(gone))
    if (fresh.length > 0) {
      for (const fault of port.attach(fresh)) onFault(fault)
      // Composed over `freshIds` alone: the ones that were already running have had their turn.
      if (port.declares('onCreate')) took(world, port.run('onCreate', compose(world, 0, freshIds)))
      // A newcomer may be the FIRST to declare `onDestroy`, and the sweep above then remembered
      // nobody. Already remembering means every entity above went through `remember`.
      if (!remembering && port.declares('onDestroy'))
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

    /** 🛑 The sandbox outlives a swap; instances left in it tick for entities nobody holds. */
    dispose: (world: World) => {
      if (known.size === 0) return

      const port = world.ports.script
      // 🛑 What was queued for the NEXT step, delivered now: there will be no next step, and
      // `SceneLoading` — the « save before leaving » idiom — is exactly what waits here.
      if (waiting.length > 0 && EVENT_HOOKS.some(hook => port.declares(hook))) {
        took(world, port.deliver(compose(world, 0), waiting))
        waiting.length = 0
      }
      // 🛑 What `onDestroy` asked for, applied like any other outcome: a hook putting a key aside
      // on the way out had its intent dropped, and its faults with it.
      took(world, port.detach([...known].map(name => closing.get(name) ?? blank(name))))
      known.clear()
      closing.clear()
    },
  }
}

/** What an event drives. A frame with none of them declared never crosses the bridge at all. */
const EVENT_HOOKS = ['onMessage', 'onCollision', 'onTriggerEnter', 'onTriggerExit']

/** What the scripts asked for, done through the world's own gestures and nothing else. */
function apply(world: World, intents: readonly ScriptIntent[]): void {
  for (const intent of intents) {
    if (applyWorldIntent(world, intent)) continue
    const entity = world.entities.get(intent.entity)
    if (!entity) continue
    applyEntityIntent(world, entity, intent)
  }
}

type WorldIntent = Extract<ScriptIntent, { act: 'log' | 'spawn' | 'emit' | 'scene' | 'keep' }>
type EntityIntent = Exclude<ScriptIntent, WorldIntent>

function applyWorldIntent(world: World, intent: ScriptIntent): intent is WorldIntent {
  if (intent.act === 'log') world.ports.log.write(intent.level, intent.message)
  else if (intent.act === 'spawn') world.spawn({ name: intent.name, transform: placed(intent.at) })
  else if (intent.act === 'emit')
    sayCustom(world, intent.name, intent.entity ?? undefined, intent.payload)
  else if (intent.act === 'scene') world.ports.scenes.load(intent.scene, intent.fade)
  else if (intent.act === 'keep') world.ports.scenes.keep(intent.key, intent.value)
  else return false
  return true
}

function applyEntityIntent(world: World, entity: Entity, intent: EntityIntent): void {
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
  } else if (intent.act === 'field') write(world, entity, intent.type, intent.key, intent.value)
  else world.destroy(intent.entity)
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
