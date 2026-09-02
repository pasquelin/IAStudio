import { Group, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { CameraPlacement } from '@/engines/scene/sceneView'
import { createGlTimer, type GlTimer } from './glTimer.js'
import { sceneVaried, type ShapeLevel } from './engineScenes'
import { checker } from './floorScenes.js'
import { pacedLod, type PacedLod } from './pacedLod'

/**
 * L'étape 2B du chantier C3 : le LOD par corps peut-il garder son gain GPU sans payer le parcours
 * des 50 000 à chaque frame ?
 *
 * Trois scénarios, parce qu'un LOD amorti ne se juge pas sur une image fixe — au REPOS il ne doit
 * rien coûter, en DÉPLACEMENT il doit tenir dans le budget, et après une TÉLÉPORTATION il doit
 * converger vite. La latence de convergence est ici une mesure de premier ordre, pas une note.
 *
 * Page à part d'`engine.html` : celui-là mesure des vues fixes, celui-ci une caméra qui bouge.
 */

const WIDTH = 1600
const HEIGHT = 900
const WARMUP = 20
/** Assez pour que le repos se lise sur des centaines de frames, comme le brief le demande. */
const REST_FRAMES = 300
const TRAVEL_FRAMES = 300
/** De quoi laisser converger même le budget le plus serré, puis mesurer l'état stable. */
const TELEPORT_FRAMES = 200

const QUERY = new URLSearchParams(location.search)
/** La marge d'hystérésis, pour mesurer ce qu'elle évite plutôt que de la supposer utile. */
const HYSTERESIS = Number(QUERY.get('hysteresis') ?? 0.15)
/**
 * Mètres parcourus par frame pendant le scénario de déplacement. Le défaut d'un mètre est le PIRE
 * cas — 120 m/s à 120 Hz — et une valeur basse est ce qu'une caméra d'éditeur fait vraiment, donc
 * là où un corps traîne autour d'un seuil et où une hystérésis se juge.
 */
const SPEED = Number(QUERY.get('speed') ?? 1)
const round = (value: number): number => Math.round(value * 1000) / 1000
const median = (values: number[]): number => {
  const sorted = [...values].sort((one, other) => one - other)
  return sorted.length === 0 ? 0 : (sorted[Math.floor(sorted.length / 2)] ?? 0)
}
const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
const top = (values: number[]): number => (values.length === 0 ? 0 : Math.max(...values))

const nextFrame = (): Promise<number> => new Promise(resolve => requestAnimationFrame(resolve))
const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/** Les appels du contexte, comme dans `engineBench` — le renderer du moteur est privé. */
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

/** Ce qu'une frame du scénario a coûté, et ce que le LOD y a fait. */
type Tick = {
  classifyMs: number
  applyMs: number
  touched: number
  changed: number
  settled: boolean
  gpu: number[]
  calls: number
  triangles: number
}

function hostOf(): HTMLDivElement {
  const stage = document.querySelector('#stage')
  if (!stage) throw new Error('no #stage')
  stage.replaceChildren()
  const host = document.createElement('div')
  host.style.width = `${WIDTH}px`
  host.style.height = `${HEIGHT}px`
  stage.append(host)
  return host
}

/**
 * Une frame du scénario : la caméra est posée, le LOD prend son tour, la scène est dessinée.
 *
 * Le coût du LOD est pris DANS la fenêtre de la frame, contrairement au banc de l'étape 2 où il
 * tombait en dehors : c'est ce qui rendait « 8,3 ms » lisible sur une frame qui en coûtait 14.
 */
function tickOf(
  renderer: SceneRenderer,
  lod: PacedLod | null,
  budget: number,
  timer: GlTimer | null,
): Promise<Tick> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resetCount()
      timer?.begin()
      const camera = renderer['viewport'].perspective
      const pumped =
        lod && lod.mark(camera)
          ? lod.pump(camera, HEIGHT, budget)
          : { classifyMs: 0, applyMs: 0, touched: 0, changed: 0, done: true }
      renderer['redraw']()
      requestAnimationFrame(() => {
        timer?.end()
        resolve({
          classifyMs: pumped.classifyMs,
          applyMs: pumped.applyMs,
          touched: pumped.touched,
          changed: pumped.changed,
          settled: lod ? lod.settled() : true,
          gpu: timer?.collect() ?? [],
          calls: counted.calls,
          triangles: Math.round(counted.triangles),
        })
      })
    })
  })
}

/** Les extrêmes du niveau, pour poser une caméra dedans et un saut d'un bout à l'autre. */
function spanOf(count: number): number {
  return Math.ceil(Math.cbrt(count)) * 1.3
}

/** La caméra posée sur l'axe des x, regardant devant elle : la traversée du niveau de part en part. */
const facing = (at: number): CameraPlacement => ({
  position: { x: at, y: 0, z: 0 },
  target: { x: at + 1, y: 0, z: 0 },
})

async function runScenario(
  renderer: SceneRenderer,
  canvas: HTMLCanvasElement,
  lod: PacedLod | null,
  budget: number,
  frames: number,
  place: (frame: number) => CameraPlacement | null,
): Promise<Tick[]> {
  const gl = canvas.getContext('webgl2')
  const timer = gl ? createGlTimer(gl) : null
  const ticks: Tick[] = []
  for (let frame = 0; frame < frames; frame += 1) {
    const placement = place(frame)
    if (placement) renderer.placeView(placement)
    ticks.push(await tickOf(renderer, lod, budget, timer))
  }
  timer?.dispose()
  return ticks
}

/** Le nombre de frames écoulées avant que le balayage ne soit allé au bout. */
const convergedAt = (ticks: Tick[]): number => {
  const at = ticks.findIndex(tick => tick.settled)
  return at < 0 ? ticks.length : at + 1
}

const fold = (prefix: string, ticks: Tick[]): Numbers => {
  const lodCpu = ticks.map(tick => tick.classifyMs + tick.applyMs)
  const gpu = ticks.flatMap(tick => tick.gpu)
  const last = ticks[ticks.length - 1]
  return {
    [`${prefix}LodMeanMs`]: round(mean(lodCpu)),
    [`${prefix}LodPeakMs`]: round(top(lodCpu)),
    [`${prefix}ClassifyMeanMs`]: round(mean(ticks.map(tick => tick.classifyMs))),
    [`${prefix}ApplyMeanMs`]: round(mean(ticks.map(tick => tick.applyMs))),
    [`${prefix}Changed`]: ticks.reduce((sum, tick) => sum + tick.changed, 0),
    [`${prefix}GpuMs`]: gpu.length > 0 ? round(median(gpu)) : null,
    [`${prefix}Calls`]: last?.calls ?? null,
    [`${prefix}Triangles`]: last?.triangles ?? null,
    [`${prefix}ConvergedFrames`]: convergedAt(ticks),
  }
}

export type Step = { level: ShapeLevel; budget: number; phase: string }

async function measureOne(
  level: ShapeLevel,
  budget: number,
  onProgress?: (step: Step) => void,
): Promise<Numbers> {
  const progress = (phase: string): void => onProgress?.({ level, budget, phase })
  progress('construction')
  const host = hostOf()
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
  renderer.apply(sceneVaried(count, 7, level))
  const reach = spanOf(count)
  renderer.placeView(facing(0))
  for (let frame = 0; frame < WARMUP; frame += 1) await nextFrame()

  const lod = budget < 0 ? null : pacedLod(renderer['viewport'].scene, level, HYSTERESIS)

  // Le LOD converge d'abord : le repos se mesure sur un système DÉJÀ à jour, jamais pendant qu'il
  // rattrape son retard.
  progress('convergence initiale')
  await runScenario(renderer, canvas, lod, budget, 120, () => null)

  progress('repos')
  const rest = await runScenario(renderer, canvas, lod, budget, REST_FRAMES, () => null)

  progress('déplacement')
  renderer.placeView(facing(-reach))
  const travel = await runScenario(renderer, canvas, lod, budget, TRAVEL_FRAMES, frame =>
    facing(-reach + frame * SPEED),
  )

  progress('téléportation')
  renderer.placeView(facing(-reach))
  await runScenario(renderer, canvas, lod, budget, 60, () => null)
  const teleport = await runScenario(renderer, canvas, lod, budget, TELEPORT_FRAMES, frame =>
    frame === 0 ? facing(reach * 0.9) : null,
  )

  lod?.dispose()
  renderer.dispose()
  host.remove()
  texture.dispose()
  await pause(400)

  return {
    level,
    budget: budget < 0 ? 'aucun' : budget === 0 ? 'tout' : budget,
    hysteresis: HYSTERESIS,
    speed: SPEED,
    bodies: count,
    ...fold('rest', rest),
    ...fold('travel', travel),
    ...fold('teleport', teleport),
  }
}

/** Ce que `run.mjs` relit si la fenêtre meurt en route. */
const partial = (report: { results: Numbers[]; failures: unknown[] }): void => {
  // `as`: le banc dépose son état sur la fenêtre, que `run.mjs` lit par CDP. Rien ne le type.
  ;(globalThis as unknown as { __partial: unknown }).__partial = report
}

export async function runLodBench(
  onProgress?: (step: Step) => void,
): Promise<{ results: Numbers[]; failures: unknown[] }> {
  const levels = (QUERY.get('lods') ?? 'product,full').split(',') as ShapeLevel[]
  // −1 : aucun LOD du tout. 0 : tout en une frame, le prototype de l'étape 2.
  const budgets = (QUERY.get('budgets') ?? '-1,0,10000,5000,2000').split(',').map(Number)
  const results: Numbers[] = []
  const failures: unknown[] = []
  for (const level of levels) {
    for (const budget of budgets) {
      try {
        results.push(await measureOne(level, budget, onProgress))
      } catch (error) {
        failures.push({ level, budget, error: String(error) })
      }
      partial({ results, failures })
    }
  }
  return { results, failures }
}
