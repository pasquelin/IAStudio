import { Group, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { checker } from './floorScenes.js'
import { nextFrame, round, since, tally } from './benchShared'
import { DEFAULT_PLAN, openWorld, spanFor } from './openWorld'
import { trajectoriesFor, type Pose, type Trajectory } from './trajectories'

/**
 * C5-B0.3 : la preuve que chaque trajectoire se rejoue à l'IDENTIQUE.
 *
 * Deux stratégies ne se comparent que sur la même trajectoire. Ce banc joue chacune deux fois sur
 * le renderer actuel et compare frame par frame ce qui a été dessiné — corps, triangles, appels.
 * Une seule frame qui diffère suffit à disqualifier le scénario.
 */

const WIDTH = 1600
const HEIGHT = 900
const WARMUP = 20
const QUERY = new URLSearchParams(location.search)

const nowhere = { position: { x: 0, y: 0, z: 0 }, target: { x: 1, y: 0, z: 0 } }

function aim(renderer: SceneRenderer, pose: Pose): void {
  const camera = renderer['viewport'].perspective
  camera.position.set(pose.position.x, pose.position.y, pose.position.z)
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
  camera.updateMatrixWorld()
}

function paint(renderer: SceneRenderer): void {
  const gl = renderer['viewport'].gl
  if (gl) gl.shadowMap.needsUpdate = true
  renderer.drawFrom(null, 0)
}

/** Ce qu'une frame a dessiné, réduit à ce qui doit se reproduire à l'identique. */
type Print = { calls: number; triangles: number; instances: number }

async function play(renderer: SceneRenderer, path: Trajectory): Promise<Print[]> {
  if (path.warmFrom) {
    aim(renderer, path.warmFrom.pose)
    for (let frame = 0; frame < path.warmFrom.frames; frame += 1) {
      paint(renderer)
      await nextFrame()
    }
  }
  const prints: Print[] = []
  for (let at = 0; at < path.frames; at += 1) {
    aim(renderer, path.poseAt(at))
    const before = tally()
    paint(renderer)
    prints.push(since(before))
    await nextFrame()
  }
  return prints
}

/** Le premier rang où deux lectures divergent, ou −1 si elles sont identiques de bout en bout. */
function divergesAt(one: Print[], other: Print[]): number {
  if (one.length !== other.length) return 0
  for (let at = 0; at < one.length; at += 1) {
    const left = one[at]
    const right = other[at]
    if (!left || !right) return at
    if (left.calls !== right.calls || left.triangles !== right.triangles || left.instances !== right.instances) {
      return at
    }
  }
  return -1
}

/**
 * L'abscisse d'une frontière de région, MESURÉE : la grille que `regionsByGrid` pose dépend des
 * centres, et aucune constante ne la connaît. On avance la caméra par pas et on retient le x où le
 * nombre d'appels de la passe change le plus — c'est là qu'une région entre ou sort.
 */
async function boundaryOf(renderer: SceneRenderer, span: number): Promise<{ at: number; jump: number }> {
  const step = span / 60
  let previous = 0
  let found = { at: 0, jump: 0 }
  for (let x = -span * 0.9; x < span * 0.9; x += step) {
    aim(renderer, { position: { x, y: 1.7, z: 0 }, target: { x: x + 1, y: 1.7, z: 0 } })
    const before = tally()
    paint(renderer)
    const calls = since(before).calls
    const jump = Math.abs(calls - previous)
    if (previous > 0 && jump > found.jump) found = { at: round(x), jump }
    previous = calls
    await nextFrame()
  }
  return found
}

export async function runTrajectoryBench(
  onProgress?: (step: { phase: string }) => void,
): Promise<{ results: unknown[]; failures: unknown[] }> {
  const count = Number(QUERY.get('bodies') ?? 500_000)
  const far = Number(QUERY.get('far') ?? 1000)
  const seed = Number(QUERY.get('seed') ?? DEFAULT_PLAN.seed)

  const stage = document.querySelector('#stage')
  if (!stage) throw new Error('no #stage')
  const host = document.createElement('div')
  host.style.width = `${WIDTH}px`
  host.style.height = `${HEIGHT}px`
  stage.append(host)

  const texture: Texture = checker()
  const renderer = new SceneRenderer({
    onSelect: () => {},
    onTransform: () => {},
    grouping: 'instanced',
    loadModel: async () => new Group(),
    loadTexture: async () => texture,
  })
  try {
    renderer.prepareOffscreen({ alpha: false, pixelRatio: 1 })
    renderer.mount(host)
    renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: true })
    const canvas = host.querySelector('canvas')
    if (!canvas) throw new Error('the engine mounted no canvas')

    onProgress?.({ phase: 'construction' })
    renderer.apply(openWorld({ ...DEFAULT_PLAN, count, seed }))
    const span = spanFor(count)
    const camera = renderer['viewport'].perspective
    camera.far = far
    camera.updateProjectionMatrix()
    aim(renderer, nowhere)
    for (let frame = 0; frame < WARMUP; frame += 1) await nextFrame()

    onProgress?.({ phase: 'frontière' })
    const boundary = await boundaryOf(renderer, span)

    const rows: unknown[] = []
    for (const path of trajectoriesFor({ span, far, seed, boundaryAt: boundary.at })) {
      onProgress?.({ phase: `${path.name} — passe 1` })
      const first = await play(renderer, path)
      onProgress?.({ phase: `${path.name} — passe 2` })
      const second = await play(renderer, path)
      const diverges = divergesAt(first, second)
      rows.push({
        name: path.name,
        seed: path.seed,
        frames: path.frames,
        warmFrames: path.warmFrom?.frames ?? 0,
        identical: diverges < 0,
        divergesAtFrame: diverges,
        firstFrame: first[0] ?? null,
        lastFrame: first[first.length - 1] ?? null,
        instancesMin: Math.min(...first.map(print => print.instances)),
        instancesMax: Math.max(...first.map(print => print.instances)),
      })
      ;(globalThis as unknown as { __partial: unknown }).__partial = { results: rows, failures: [] }
    }

    return {
      results: [{ count, far, seed, span: Math.round(span), boundary, bufferWidth: canvas.width, paths: rows }],
      failures: [],
    }
  } finally {
    renderer.dispose()
    host.remove()
    texture.dispose()
  }
}
