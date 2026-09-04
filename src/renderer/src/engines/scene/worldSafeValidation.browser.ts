import {
  AnimationClip,
  BoxGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  NumberKeyframeTrack,
} from 'three'
import { worldBenchmarkScenes, type WorldBenchmarkId } from './worldBenchmarkScenes.fixture'
import type { SceneState } from './sceneState'
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
  cameraCount: number
  observedPickSamples: number
  failedChecks: readonly string[]
}

const MAXIMUM_RASTER_CHANGED_PIXEL_RATIO = 0.002
const VALIDATION_FRAME_SIZE = 128

async function validateWorldBenchmarksInBrowser(): Promise<readonly WorldSafeValidationResult[]> {
  const results: WorldSafeValidationResult[] = []
  for (const benchmark of worldBenchmarkScenes()) {
    const cameras = camerasFor(benchmark.state)
    const driver = createSceneRuntimeValidationDriver({
      cameras,
      renderer: {
        loadModel: async () => benchmarkModel(),
        loadTexture: async () => benchmarkTexture(),
      },
    })
    let nonUniformFrames = 0
    let observedPickSamples = 0
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
          observedPickSamples += renderedPickCount(snapshot.picking)
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
      cameraCount: cameras.length,
      observedPickSamples,
      failedChecks: report.functional.flatMap(result => (result.equivalent ? [] : [result.check])),
    })
  }
  return results
}

function renderedPickCount(value: unknown): number {
  if (typeof value !== 'object' || value === null) return 0
  const rendered = Reflect.get(value, 'rendered')
  if (!Array.isArray(rendered)) return 0
  return rendered.reduce(
    (count, entry) =>
      count + (Array.isArray(entry) && Array.isArray(entry[1]) ? entry[1].length : 0),
    0,
  )
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
