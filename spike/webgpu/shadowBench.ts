import { Box3, DirectionalLight, Group, Vector3, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { CameraPlacement } from '@/engines/scene/sceneView'
import { createGlTimer, type GlTimer } from './glTimer.js'
import { sceneField, sceneVaried, type ShapeLevel } from './engineScenes'
import { checker } from './floorScenes.js'
import { boxSpan, shadowBoxFor, wearShadowBox, SHADOW_FITS, type ShadowFit } from './shadowVolume'

/**
 * C4 : ce qu'une carte d'ombre ajustée sur la VUE rend, et ce qu'elle coûte.
 *
 * Les triangles d'ombre se lisent par différence — la même vue rendue avec et sans ombre — parce
 * que rien dans WebGL ne dit à quelle passe un appel appartient. C'est ce que C2 faisait déjà.
 */

const WIDTH = 1600
const HEIGHT = 900
const WARMUP = 25
const BLOCKS = 10
const FRAMES = 15
const QUERY = new URLSearchParams(location.search)

const round = (value: number): number => Math.round(value * 1000) / 1000
const median = (values: number[]): number => {
  const sorted = [...values].sort((one, other) => one - other)
  return sorted.length === 0 ? 0 : (sorted[Math.floor(sorted.length / 2)] ?? 0)
}
const nextFrame = (): Promise<number> => new Promise(resolve => requestAnimationFrame(resolve))
const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const counted = { calls: 0, triangles: 0 }
const resetCount = (): void => {
  counted.calls = 0
  counted.triangles = 0
}
{
  const proto = WebGL2RenderingContext.prototype
  const TRIANGLES = WebGL2RenderingContext.TRIANGLES
  const drawElements = proto.drawElements
  proto.drawElements = function (mode, count, type, offset) {
    counted.calls++
    if (mode === TRIANGLES) counted.triangles += count / 3
    return drawElements.call(this, mode, count, type, offset)
  }
  const drawElementsInstanced = proto.drawElementsInstanced
  proto.drawElementsInstanced = function (mode, count, type, offset, instances) {
    counted.calls++
    if (mode === TRIANGLES) counted.triangles += (count / 3) * instances
    return drawElementsInstanced.call(this, mode, count, type, offset, instances)
  }
}

type Numbers = Record<string, number | string | null>

/** Le soleil de la scène, seul à porter une carte d'ombre orthographique. */
function sunOf(scene: Group | { traverse: (visit: (object: unknown) => void) => void }): DirectionalLight | null {
  let found: DirectionalLight | null = null
  scene.traverse(object => {
    if (object instanceof DirectionalLight && object.castShadow) found = object
  })
  return found
}

async function frameOnce(renderer: SceneRenderer, timer: GlTimer | null): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resetCount()
      timer?.begin()
    })
    renderer['redraw']()
    requestAnimationFrame(() => {
      timer?.end()
      resolve()
    })
  })
}

type Seen = { gpu: number; calls: number; triangles: number; cpu: number }

async function watch(
  renderer: SceneRenderer,
  canvas: HTMLCanvasElement,
  refit: () => number,
): Promise<Seen> {
  const gl = canvas.getContext('webgl2')
  const timer = gl ? createGlTimer(gl) : null
  for (let frame = 0; frame < WARMUP; frame += 1) {
    refit()
    await frameOnce(renderer, timer)
  }
  timer?.collect()

  const gpu: number[] = []
  for (let frame = 0; frame < 60; frame += 1) {
    refit()
    await frameOnce(renderer, timer)
    gpu.push(...(timer?.collect() ?? []))
  }
  for (let frame = 0; frame < 4; frame += 1) {
    await nextFrame()
    gpu.push(...(timer?.collect() ?? []))
  }

  // Le CPU du calcul du volume, sur un bloc : `performance.now()` est clampé à 100 µs.
  const cpu: number[] = []
  for (let block = 0; block < BLOCKS; block += 1) {
    const started = performance.now()
    for (let frame = 0; frame < FRAMES; frame += 1) refit()
    cpu.push((performance.now() - started) / FRAMES)
    await nextFrame()
  }
  timer?.dispose()
  return {
    gpu: gpu.length > 0 ? round(median(gpu)) : 0,
    calls: counted.calls,
    triangles: Math.round(counted.triangles),
    cpu: round(median(cpu)),
  }
}

export type Step = { level: ShapeLevel; fit: string; view: string }

const VIEWS = ['full', 'turned', 'inside', 'ground'] as const
type View = (typeof VIEWS)[number]

async function measureOne(
  level: ShapeLevel,
  fit: ShadowFit,
  shadowFar: number,
  onProgress?: (step: Step) => void,
): Promise<Numbers[]> {
  const stage = document.querySelector('#stage')
  if (!stage) throw new Error('no #stage')
  stage.replaceChildren()
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
  renderer.prepareOffscreen({ alpha: false, pixelRatio: 1 })
  renderer.mount(host)
  renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: true })
  const canvas = host.querySelector('canvas')
  if (!canvas) throw new Error('the engine mounted no canvas')

  const count = Number(QUERY.get('bodies') ?? 50_000)
  /** La map plate de C4 : `span` est son demi-côté. Zéro garde la scène cubique de C1 à C3. */
  const span = Number(QUERY.get('span') ?? 0)
  renderer.apply(span > 0 ? sceneField(count, span, 11, level) : sceneVaried(count, 7, level))
  renderer.frameContents()
  const full = renderer.viewPlacement()
  const reach = span > 0 ? span : Math.ceil(Math.cbrt(count)) * 1.3
  const scene =
    span > 0
      ? new Box3(new Vector3(-span, -2, -span), new Vector3(span, 8, span))
      : new Box3(new Vector3(-reach, -reach, -reach), new Vector3(reach, reach, reach))
  const camera = renderer['viewport'].perspective
  const sun = sunOf(renderer['viewport'].scene)
  if (!sun) throw new Error('the scene carries no shadow-casting sun')

  const refit = (): number => {
    const box = shadowBoxFor(fit, sun.shadow.camera, camera, scene, shadowFar, reach * 2)
    wearShadowBox(sun.shadow.camera, box)
    return boxSpan(box)
  }

  const placements: Record<View, CameraPlacement> = {
    full,
    turned: { position: full.position, target: { x: full.position.x, y: full.position.y, z: full.position.z - 1 } },
    inside: { position: { x: 0, y: 0, z: 0 }, target: { x: 1, y: 0, z: 0 } },
    // Posée AU SOL et regardant l'horizon : la vue d'un jeu, et celle où une map plate ne se
    // laisse voir qu'en partie.
    ground: { position: { x: -reach * 0.8, y: span > 0 ? 2 : -reach * 0.9, z: 0 }, target: { x: 1, y: span > 0 ? 2 : -reach * 0.9, z: 0 } },
  }

  const rows: Numbers[] = []
  for (const view of VIEWS) {
    onProgress?.({ level, fit, view })
    renderer.placeView(placements[view])
    await nextFrame()
    const span = refit()
    const lit = await watch(renderer, canvas, refit)

    // La même vue sans ombre : la différence EST la passe d'ombre, faute de savoir à quelle passe
    // un appel de dessin appartient.
    renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: false })
    await nextFrame()
    const bare = await watch(renderer, canvas, () => 0)
    renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: true })
    await nextFrame()

    rows.push({
      level,
      fit,
      shadowFar,
      view,
      span: round(span),
      gpuMs: lit.gpu,
      gpuNoShadowMs: bare.gpu,
      shadowGpuMs: round(lit.gpu - bare.gpu),
      calls: lit.calls,
      shadowCalls: lit.calls - bare.calls,
      triangles: lit.triangles,
      shadowTriangles: lit.triangles - bare.triangles,
      fitCpuMs: lit.cpu,
    })
  }

  renderer.dispose()
  host.remove()
  texture.dispose()
  await pause(400)
  return rows
}

export async function runShadowBench(
  onProgress?: (step: Step) => void,
): Promise<{ results: Numbers[]; failures: unknown[] }> {
  const levels = (QUERY.get('lods') ?? 'product,full').split(',') as ShapeLevel[]
  const fits = (QUERY.get('fits') ?? SHADOW_FITS.join(',')).split(',') as ShadowFit[]
  const shadowFar = Number(QUERY.get('shadowFar') ?? 0)
  const results: Numbers[] = []
  const failures: unknown[] = []
  for (const level of levels) {
    for (const fit of fits) {
      try {
        results.push(...(await measureOne(level, fit, shadowFar, onProgress)))
      } catch (error) {
        failures.push({ level, fit, error: String(error) })
      }
      ;(globalThis as unknown as { __partial: unknown }).__partial = { results, failures }
    }
  }
  return { results, failures }
}
