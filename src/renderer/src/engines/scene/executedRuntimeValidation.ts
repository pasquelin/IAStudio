import type { GameApi } from '@game/api/gameApi'
import { createInertAudio } from '@game/host/inertAudio'
import { createInertPhysics } from '@game/host/inertPhysics'
import { createInertRender } from '@game/host/inertRender'
import { createInertScripts } from '@game/host/inertScripts'
import { createStudioHost } from '@game/host/studioHost'
import type { BodyDescriptor, PhysicsPort } from '@game/ports/physicsPort'
import type { ScriptModule, ScriptPort } from '@game/ports/scriptPort'
import type { World } from '@game/runtime/world'
import { NO_OUTCOME, type ScriptHook } from '@game/script/frame'
import { stableKey } from '@shared/hash'
import { emptyHistory, redo, run, undo } from '@/engines/core/history'
import { worldFromScene } from '@/game/worldFromScene'
import { addNodes, copiesOf } from './commands'
import { subtreesOf, type SceneNode, type SceneState } from './sceneState'
import type { SafeRuntimeSnapshot } from './safeRuntimeValidation'

type ExecutedChecks = Pick<
  SafeRuntimeSnapshot,
  'scripts' | 'physics' | 'timeline' | 'duplication' | 'undoRedo'
>
export type RuntimeFunctionalValidationOptions = {
  modules?: readonly ScriptModule[]
  createPhysics?: () => Promise<PhysicsPort>
  createScripts?: () => Promise<ScriptPort>
}
type ScriptProbe = {
  port: ScriptPort
  hooks: ScriptHook[]
  frames: number[]
  events: string[]
  faults: string[]
}
type PhysicsProbe = { port: PhysicsPort; bodies: BodyDescriptor[]; steps: number[] }
const FIXED_STEP = 1 / 60
const VALIDATION_STEPS = 10

export async function executeRuntimeFunctionalChecks(
  state: SceneState,
  options: RuntimeFunctionalValidationOptions = {},
): Promise<ExecutedChecks> {
  let script: ScriptPort | undefined
  let physicsPort: PhysicsPort | undefined
  let host: GameApi | undefined
  let world: World | undefined
  const timeline = { veils: [] as number[], scenes: [] as { scene: string; fade: number }[] }

  try {
    const scripts = scriptProbe(
      (await options.createScripts?.()) ?? deterministicValidationScripts(),
    )
    script = scripts.port
    const physics = physicsProbe((await options.createPhysics?.()) ?? createInertPhysics())
    physicsPort = physics.port
    host = createStudioHost({
      input: document.createElement('div'),
      player: { id: 'runtime-validation', name: 'Runtime validation', local: true },
      urlForAsset: id => id,
      script,
      physics: physicsPort,
      render: { ...createInertRender(), veil: amount => timeline.veils.push(amount) },
      scenes: {
        kept: () => ({}),
        keep: () => {},
        load: (scene, fade) => timeline.scenes.push({ scene, fade }),
      },
      audio: createInertAudio(),
    })
    world = worldFromScene('runtime-validation', state, host, { modules: options.modules ?? [] })
    for (let step = 0; step < VALIDATION_STEPS; step += 1) world.step(FIXED_STEP)
    world.lateUpdate(0, FIXED_STEP)
    const entities = [...world.entities.all()]
      .map(entity => ({ id: entity.id, transform: structuredClone(entity.transform) }))
      .sort((left, right) => left.id.localeCompare(right.id, 'en'))
    const edited = editingChecks(state)
    return {
      scripts: {
        hooks: scripts.hooks,
        frames: scripts.frames,
        events: scripts.events,
        faults: scripts.faults,
        entities,
        disarmed: script.disarmed(),
      },
      physics: {
        bodies: physics.bodies.map(body => ({ body: body.body, kind: body.kind })),
        steps: physics.steps,
        entities,
      },
      timeline,
      duplication: edited.duplication,
      undoRedo: edited.undoRedo,
    }
  } finally {
    try {
      world?.dispose()
    } finally {
      try {
        host?.input.detach()
      } finally {
        try {
          host?.audio.stopAll()
        } finally {
          try {
            physicsPort?.dispose()
          } finally {
            script?.dispose()
          }
        }
      }
    }
  }
}

function scriptProbe(base: ScriptPort): ScriptProbe {
  const hooks: ScriptHook[] = []
  const frames: number[] = []
  const events: string[] = []
  const faults: string[] = []
  const port: ScriptPort = {
    ...base,
    run: (hook, frame) => {
      const outcome = base.run(hook, frame)
      hooks.push(hook)
      frames.push(frame.tick)
      faults.push(...outcome.faults.map(fault => fault.message))
      return outcome
    },
    deliver: (frame, delivered) => {
      const outcome = base.deliver(frame, delivered)
      events.push(
        ...delivered.map(event => {
          const chosen = event.payload.name
          return event.name === 'Custom' && typeof chosen === 'string' ? chosen : event.name
        }),
      )
      faults.push(...outcome.faults.map(fault => fault.message))
      return outcome
    },
  }
  return { port, hooks, frames, events, faults }
}

function deterministicValidationScripts(): ScriptPort {
  return {
    ...createInertScripts(),
    declares: hook => hook === 'onUpdate' || hook === 'onMessage',
    run: (_hook, frame) => ({
      intents: frame.entities.map(entity => ({
        act: 'move',
        entity: entity.entity,
        by: { x: FIXED_STEP, y: 0, z: 0 },
      })),
      faults: [],
    }),
    deliver: () => NO_OUTCOME,
  }
}

function physicsProbe(base: PhysicsPort): PhysicsProbe {
  const bodies: BodyDescriptor[] = []
  const steps: number[] = []
  return {
    bodies,
    steps,
    port: {
      ...base,
      add: added => {
        const refused = base.add(added)
        const refusedIds = new Set(refused)
        bodies.push(
          ...added.filter(body => !refusedIds.has(body.body)).map(body => structuredClone(body)),
        )
        return refused
      },
      step: dt => {
        base.step(dt)
        steps.push(dt)
      },
    },
  }
}

function editingChecks(state: SceneState): Pick<ExecutedChecks, 'duplication' | 'undoRedo'> {
  const picked =
    state.nodes.find(node => state.nodes.some(candidate => candidate.parentId === node.id)) ??
    state.nodes.find(node => node.type === 'mesh' && (node.instances?.length ?? 0) > 0) ??
    state.nodes[0]
  if (!picked) return { duplication: [], undoRedo: [] }

  const originals = subtreesOf(state.nodes, [picked.id])
  const copies = copiesOf(state.nodes, [picked])
  const [applied, afterApply] = run(state, emptyHistory<SceneState>(), addNodes(copies))
  const [undone, afterUndo] = undo(applied, afterApply)
  const [redone] = redo(undone, afterUndo)
  return {
    duplication: {
      originals: normalizedNodes(originals),
      copies: normalizedNodes(copies),
      equivalent: stableKey(normalizedNodes(originals)) === stableKey(normalizedNodes(copies)),
      freshIds: copies.every(copy => !state.nodes.some(node => node.id === copy.id)),
      freshInstanceIds: copiedInstanceIdsAreFresh(state.nodes, copies),
    },
    undoRedo: {
      applied: normalizedState(applied),
      undone: normalizedState(undone),
      redone: normalizedState(redone),
      restored: stableKey(normalizedState(state)) === stableKey(normalizedState(undone)),
      replayed: stableKey(normalizedState(applied)) === stableKey(normalizedState(redone)),
    },
  }
}

export function copiedInstanceIdsAreFresh(
  source: readonly SceneNode[],
  copies: readonly SceneNode[],
): boolean {
  const originalInstances = new Set(instanceSourceIds(source))
  const copiedInstances = instanceSourceIds(copies)
  const nodeIds = new Set([...source, ...copies].map(node => node.id))
  return (
    copiedInstances.every(id => !originalInstances.has(id) && !nodeIds.has(id)) &&
    new Set(copiedInstances).size === copiedInstances.length
  )
}

function instanceSourceIds(nodes: readonly SceneNode[]): string[] {
  return nodes.flatMap(node =>
    node.type === 'mesh' ? (node.instances ?? []).map(one => one.sourceId) : [],
  )
}

function normalizedState(state: SceneState): unknown {
  const positions = new Map(state.nodes.map((node, index) => [node.id, index]))
  return {
    nodes: normalizedNodes(state.nodes),
    selected: state.selectedIds.map(id => positions.get(id) ?? `external:${id}`),
  }
}

function normalizedNodes(nodes: readonly SceneNode[]): unknown {
  const positions = new Map(nodes.map((node, index) => [node.id, index]))
  return nodes.map(node => ({
    name: node.name,
    type: node.type,
    parent: node.parentId === null ? null : (positions.get(node.parentId) ?? 'external'),
    visible: node.visible,
    transform: node.transform,
    castShadow: node.castShadow,
    receiveShadow: node.receiveShadow,
    components: node.components ?? [],
    attach: node.attach ?? null,
    optimization: node.optimization ?? null,
    payload: normalizedPayload(node),
  }))
}

function normalizedPayload(node: SceneNode): unknown {
  if (node.type === 'mesh')
    return {
      geometry: node.geometry,
      material: node.material,
      negative: node.negative ?? false,
      instances: (node.instances ?? []).map((instance, index) => ({
        source: index,
        name: instance.name,
        transform: instance.transform,
      })),
    }
  if (node.type === 'light') return node.light
  if (node.type === 'model') return node.model
  if (node.type === 'sprite') return node.sprite
  if (node.type === 'text') return { text: node.text, material: node.material }
  if (node.type === 'carved')
    return { carved: node.carved, material: node.material, negative: node.negative ?? false }
  if (node.type === 'camera') return node.camera
  if (node.type === 'path') return node.path
  return null
}
