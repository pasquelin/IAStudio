import {
  AnimationClip,
  BoxGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  NumberKeyframeTrack,
} from 'three'
import { loadJoltPhysics } from '@game/host/joltPhysics'
import { loadQuickjsScripts } from '@game/host/quickjsScripts'
import {
  worldBenchmarkScenes,
  type WorldBenchmarkId,
  type WorldBenchmarkMeasure,
} from './worldBenchmarkScenes.fixture'
import { nodesDeclaring, PHYSICS_COMPONENT_TYPES } from './sceneRuntimeSnapshot'
import type { SceneNode, SceneState } from './sceneState'
import type { ValidationEntity } from './executedRuntimeValidation'
import {
  validateRuntimeRepresentation,
  type RuntimeRenderCamera,
} from './runtimeRepresentationValidation'
import { createSceneRuntimeValidationDriver } from './sceneRuntimeValidationDriver'

type WorldSafeValidationResult = {
  id: WorldBenchmarkId
  equivalent: boolean
  changedPixelRatios: readonly number[]
  maximumChannelDifferences: readonly number[]
  nonUniformFrames: number
  renderedFrames: number
  observedPickSamples: number
  executedScriptHooks: number
  successfulScriptEffects: number
  scriptFaults: number
  simulatedPhysicsBodies: number
  simulatedPhysicsSteps: number
  simulatedPhysicsEffects: number
  executedTimelineActions: number
  successfulDuplications: number
  successfulUndoRedo: number
  failedChecks: readonly string[]
  expects: readonly WorldBenchmarkMeasure[]
}

const BENCHMARK_SCRIPT =
  'exports.default = defineScript({ onUpdate(self) { self.moveBy(0.01, 0, 0) }, onMessage() {} })'

const MAXIMUM_RASTER_CHANGED_PIXEL_RATIO = 0.002
const VALIDATION_FRAME_SIZE = 128

async function validateWorldBenchmarksInBrowser(): Promise<readonly WorldSafeValidationResult[]> {
  const results: WorldSafeValidationResult[] = []
  for (const benchmark of worldBenchmarkScenes()) {
    const cameras = camerasFor(benchmark.state)
    const scripted = nodesDeclaring(benchmark.state, ['Script'])
    const physical = nodesDeclaring(benchmark.state, PHYSICS_COMPONENT_TYPES)
    const driver = benchmarkDriver(cameras, scripted, physical)
    let nonUniformFrames = 0
    let observedPickSamples = 0
    let executedScriptHooks = 0
    let successfulScriptEffects = 0
    let scriptFaults = 0
    let simulatedPhysicsBodies = 0
    let simulatedPhysicsSteps = 0
    let simulatedPhysicsEffects = 0
    let executedTimelineActions = 0
    let successfulDuplications = 0
    let successfulUndoRedo = 0
    const report = await validateRuntimeRepresentation(benchmark.state, {
      cameras,
      visualOptions: {
        channelTolerance: 1,
        maximumChangedPixelRatio: MAXIMUM_RASTER_CHANGED_PIXEL_RATIO,
      },
      driver: {
        ...driver,
        render: async (representation, currentCamera) => {
          const frame = await driver.render(representation, currentCamera)
          if (hasPixelVariation(frame.pixels)) nonUniformFrames += 1
          return frame
        },
        observe: async representation => {
          const snapshot = await driver.observe(representation)
          observedPickSamples += snapshot.picking.rendered.reduce(
            (count, [, picks]) => count + picks.length,
            0,
          )
          executedScriptHooks += snapshot.scripts.hooks.length
          successfulScriptEffects += movedFromStart(snapshot.scripts.entities, scripted) ? 1 : 0
          scriptFaults += snapshot.scripts.faults.length
          simulatedPhysicsBodies += snapshot.physics.bodies.length
          simulatedPhysicsSteps += snapshot.physics.steps.length
          simulatedPhysicsEffects += movedFromStart(snapshot.physics.entities, physical) ? 1 : 0
          executedTimelineActions += snapshot.timeline.scenes.length
          successfulDuplications +=
            snapshot.duplication.equivalent &&
            snapshot.duplication.freshIds &&
            snapshot.duplication.freshInstanceIds
              ? 1
              : 0
          successfulUndoRedo += snapshot.undoRedo.restored && snapshot.undoRedo.replayed ? 1 : 0
          return snapshot
        },
      },
    })
    results.push({
      id: benchmark.id,
      equivalent: report.equivalent,
      changedPixelRatios: report.visual.map(result => result.changedPixelRatio),
      maximumChannelDifferences: report.visual.map(result => result.maximumChannelDifference),
      nonUniformFrames,
      renderedFrames: report.renderedFrames,
      observedPickSamples,
      executedScriptHooks,
      successfulScriptEffects,
      scriptFaults,
      simulatedPhysicsBodies,
      simulatedPhysicsSteps,
      simulatedPhysicsEffects,
      executedTimelineActions,
      successfulDuplications,
      successfulUndoRedo,
      failedChecks: report.functional.flatMap(result => (result.equivalent ? [] : [result.check])),
      expects: benchmark.expects,
    })
  }
  return results
}

/** Jolt and QuickJS are loaded only for a scene that declares physics or scripts. */
function benchmarkDriver(
  cameras: readonly RuntimeRenderCamera[],
  scripted: readonly SceneNode[],
  physical: readonly SceneNode[],
): ReturnType<typeof createSceneRuntimeValidationDriver> {
  return createSceneRuntimeValidationDriver({
    cameras,
    renderer: {
      loadModel: async () => benchmarkModel(),
      loadTexture: async () => benchmarkTexture(),
    },
    functional: {
      createPhysics: physical.length > 0 ? loadJoltPhysics : undefined,
      createScripts: scripted.length > 0 ? loadQuickjsScripts : undefined,
      modules: scriptIdsOf(scripted).map(script => ({ script, code: BENCHMARK_SCRIPT })),
    },
  })
}

/** Deduplicated: two nodes may name the same script, and one module per name is what loads. */
function scriptIdsOf(nodes: readonly SceneNode[]): readonly string[] {
  return [
    ...new Set(
      nodes.flatMap(node =>
        (node.components ?? []).flatMap(component =>
          component.type === 'Script' && typeof component.script === 'string'
            ? [component.script]
            : [],
        ),
      ),
    ),
  ]
}

/** Each node is compared against ITS OWN starting position — no scene states where it began. */
function movedFromStart(
  entities: readonly ValidationEntity[],
  nodes: readonly SceneNode[],
): boolean {
  return nodes.some(node => {
    const entity = entities.find(candidate => candidate.id === node.id)
    if (!entity) return false
    const start = node.transform.position
    const now = entity.transform.position
    return now.x !== start.x || now.y !== start.y || now.z !== start.z
  })
}

function benchmarkModel(): Group {
  const model = new Group()
  model.add(new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial({ color: '#888888' })))
  model.animations.push(
    new AnimationClip('idle', 1, [new NumberKeyframeTrack('.rotation[y]', [0, 1], [0, Math.PI])]),
  )
  return model
}

function benchmarkTexture(): DataTexture {
  const texture = new DataTexture(
    new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]),
    2,
    2,
  )
  texture.needsUpdate = true
  return texture
}

Reflect.set(window, '__iaValidateWorldBenchmarks', validateWorldBenchmarksInBrowser)

function camerasFor(state: SceneState): readonly RuntimeRenderCamera[] {
  const points = state.nodes.map(node => node.transform.position)
  const minimum = {
    x: Math.min(...points.map(point => point.x)),
    y: Math.min(...points.map(point => point.y)),
    z: Math.min(...points.map(point => point.z)),
  }
  const maximum = {
    x: Math.max(...points.map(point => point.x)),
    y: Math.max(...points.map(point => point.y)),
    z: Math.max(...points.map(point => point.z)),
  }
  const target = {
    x: (minimum.x + maximum.x) / 2,
    y: (minimum.y + maximum.y) / 2,
    z: (minimum.z + maximum.z) / 2,
  }
  const distance = Math.max(20, maximum.x - minimum.x, maximum.z - minimum.z) * 1.6
  return [
    camera('front', target, target.x, target.y + distance / 2, target.z + distance),
    camera('side', target, target.x + distance, target.y + distance / 2, target.z),
    camera(
      'top',
      target,
      target.x,
      target.y + distance,
      target.z + distance / 100,
      'orthographic',
      distance,
    ),
  ]
}

function camera(
  id: string,
  target: { x: number; y: number; z: number },
  x: number,
  y: number,
  z: number,
  projection: RuntimeRenderCamera['projection'] = 'perspective',
  orthographicSize?: number,
): RuntimeRenderCamera {
  return {
    id,
    position: { x, y, z },
    target,
    projection,
    fieldOfView: 50,
    orthographicSize,
    near: 0.1,
    far:
      Math.max(1_000, Math.abs(x - target.x), Math.abs(y - target.y), Math.abs(z - target.z)) * 4,
    width: VALIDATION_FRAME_SIZE,
    height: VALIDATION_FRAME_SIZE,
    cameraMask: 1,
  }
}

function hasPixelVariation(pixels: Uint8Array): boolean {
  for (let offset = 4; offset < pixels.length; offset += 4) {
    if (
      pixels[offset] !== pixels[0] ||
      pixels[offset + 1] !== pixels[1] ||
      pixels[offset + 2] !== pixels[2] ||
      pixels[offset + 3] !== pixels[3]
    )
      return true
  }
  return false
}
