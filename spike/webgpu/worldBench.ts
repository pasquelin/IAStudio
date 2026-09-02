import { Frustum, Group, InstancedMesh, Matrix4, Vector3, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { CameraPlacement } from '@/engines/scene/sceneView'
import { TRIANGLES_PER_REGION } from '@/engines/scene/instanceRegions'
import { createGlTimer, type GlTimer } from './glTimer.js'
import { checker } from './floorScenes.js'
import { mean, median, nextFrame, pause, round, since, sunOf, tally, top } from './benchShared'
import { centresOf, DEFAULT_PLAN, openWorld, spanFor, worldShape, WORLD_SPREADS, type WorldSpread } from './openWorld'
import type { ShapeLevel } from './engineScenes'

/** Les résolutions de forme qu'`engineScenes` publie, pour valider ce qui vient de l'URL. */
const SHAPE_LEVELS: readonly ShapeLevel[] = ['product', 'full', 'half', 'quarter', 'tenth']

/**
 * C5-A : ce que coûte un monde ouvert vu depuis dedans, et C5-B (a) : ce que le grain de région
 * déjà en production y rejette. Le grain se balaie en modifiant `TRIANGLES_PER_REGION` entre deux
 * lancements ; chaque relevé le réécrit, donc un fichier dit de lui-même sous quel grain il est né.
 */

const WIDTH = 1600
const HEIGHT = 900
const WARMUP = 20
const REST_FRAMES = 240
const MOVE_FRAMES = 300
const SPIN_FRAMES = 180
const TELEPORT_FRAMES = 180
/** Blocs de quinze : `performance.now()` est clampé à 100 µs et une passe passe dessous. */
const BLOCKS = 10
const FRAMES = 15
const EYES = 1.7

const QUERY = new URLSearchParams(location.search)

/**
 * 🛑 Un paramètre CASTÉ produit une ligne plausible et mal étiquetée : `spreads=clusterd` bâtissait
 * un monde uniforme et l'écrivait « clusterd », donc le rapport comparait uniforme à uniforme.
 * Tout ce qui vient de l'URL est vérifié contre ses valeurs, et un intrus arrête le banc.
 */
function oneOf<T extends string>(name: string, allowed: readonly T[], fallback: T): T[] {
  const raw = QUERY.get(name)
  if (raw === null) return [fallback]
  const asked = raw.split(',').map(part => part.trim())
  for (const one of asked) {
    if (!allowed.includes(one as T)) throw new Error(`${name}: "${one}" n'est pas dans ${allowed.join(', ')}`)
  }
  return asked as T[]
}

function numbersOf(name: string, fallback: number[]): number[] {
  const raw = QUERY.get(name)
  if (raw === null) return fallback
  return raw.split(',').map(part => {
    const value = Number(part.trim())
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name}: "${part}" n'est pas un nombre positif`)
    return value
  })
}

const SHADOW_DEPTH = oneOf<'default' | 'fit'>('shadowDepth', ['default', 'fit'], 'default')[0] ?? 'default'

type Numbers = Record<string, number | string | null>

/** Combien d'`InstancedMesh` la scène porte : ce que le frustum a À CONSIDÉRER, une sphère chacun. */
function regionsOf(root: { traverse: (visit: (object: unknown) => void) => void }): number {
  let many = 0
  root.traverse(object => {
    if (object instanceof InstancedMesh) many += 1
  })
  return many
}

/**
 * 🛑 La caméra se pose DIRECTEMENT, sans `placeView`. Celui-ci finit sur `repaint()`, qui planifie
 * une frame du viewport : sur chaque frame à caméra mobile la scène était dessinée DEUX fois et la
 * carte d'ombre reconstruite deux fois, dont une hors de toute mesure. `walkGpuMs` se comparait
 * alors à `restGpuMs` comme si seul le mouvement les séparait.
 */
function aim(renderer: SceneRenderer, placement: CameraPlacement): void {
  const camera = renderer['viewport'].perspective
  camera.position.set(placement.position.x, placement.position.y, placement.position.z)
  camera.lookAt(placement.target.x, placement.target.y, placement.target.z)
  camera.updateMatrixWorld()
}

/**
 * Une frame, dessinée par NOUS. `drawFrom` est SYNCHRONE : rien ne s'intercale entre deux lectures
 * de compteur et le chronomètre encadre exactement un dessin.
 *
 * 🛑 Le viewport pose `shadowMap.autoUpdate = false`, donc three ne redessine la carte que sur
 * `shadowMap.needsUpdate` du RENDERER — `light.shadow.needsUpdate` ne suffit pas. Le studio ne la
 * redessine pas quand seule la caméra bouge ; un volume ajusté sur la VUE l'exigerait, et c'est ce
 * coût-là que ce drapeau rend lisible.
 */
function paint(renderer: SceneRenderer, withShadow: boolean): void {
  const gl = renderer['viewport'].gl
  if (gl) gl.shadowMap.needsUpdate = withShadow
  renderer.drawFrom(null, 0)
}

type Drawn = { cpu: number; calls: number; triangles: number; instances: number }

/** La même frame, comptée. Le relevé des compteurs est HORS du chronomètre, jamais dedans. */
function drawOnce(renderer: SceneRenderer, withShadow: boolean): Drawn {
  const before = tally()
  const started = performance.now()
  paint(renderer, withShadow)
  const cpu = performance.now() - started
  return { cpu, ...since(before) }
}

type Tick = Drawn & { gpu: number[] }

async function runScenario(
  renderer: SceneRenderer,
  canvas: HTMLCanvasElement,
  frames: number,
  place: (frame: number) => CameraPlacement | null,
): Promise<Tick[]> {
  const gl = canvas.getContext('webgl2')
  const timer = gl ? createGlTimer(gl) : null
  const ticks: Tick[] = []
  for (let frame = 0; frame < frames; frame += 1) {
    const placement = place(frame)
    if (placement) aim(renderer, placement)
    timer?.begin()
    const drawn = drawOnce(renderer, true)
    timer?.end()
    await nextFrame()
    ticks.push({ ...drawn, gpu: timer?.collect() ?? [] })
  }
  timer?.dispose()
  return ticks
}

/** Un bloc de quinze dessins nus, sans comptage : ce qui n'est pas mesuré ne coûte rien au bloc. */
async function blockCost(renderer: SceneRenderer, withShadow: boolean): Promise<number> {
  const blocks: number[] = []
  for (let block = 0; block < BLOCKS; block += 1) {
    const started = performance.now()
    for (let frame = 0; frame < FRAMES; frame += 1) paint(renderer, withShadow)
    blocks.push((performance.now() - started) / FRAMES)
    await nextFrame()
  }
  return round(median(blocks))
}

/**
 * Ce que la scène coûte, caméra FIGÉE là où le scénario l'a laissée. La part d'ombre se prend par
 * DIFFÉRENCE avec une frame qui ne la redessine pas : rien dans WebGL ne dit à quelle passe un
 * appel appartient.
 */
async function settledCosts(renderer: SceneRenderer, prefix: string): Promise<Numbers> {
  const withShadow = await blockCost(renderer, true)
  const lit = drawOnce(renderer, true)
  const colour = await blockCost(renderer, false)
  const bare = drawOnce(renderer, false)

  return {
    [`${prefix}ScenePassCpuMs`]: withShadow,
    [`${prefix}ColourPassCpuMs`]: colour,
    [`${prefix}ColourCalls`]: bare.calls,
    [`${prefix}ColourTriangles`]: bare.triangles,
    [`${prefix}ColourInstances`]: bare.instances,
    [`${prefix}ShadowCalls`]: lit.calls - bare.calls,
    [`${prefix}ShadowTriangles`]: lit.triangles - bare.triangles,
    [`${prefix}ShadowInstances`]: lit.instances - bare.instances,
  }
}

/**
 * Ce que la ZONE ACTIVE contient, mesuré sur les centres de l'état plutôt que sur ce que le moteur
 * en fait : `inRange` est la sphère de rayon `far` autour de la caméra, `inFrustum` ce que la
 * caméra cadre vraiment. Hors chronomètre — c'est un oracle, pas une charge.
 */
function activeSet(centres: Float64Array, renderer: SceneRenderer): { inRange: number; inFrustum: number } {
  const camera = renderer['viewport'].perspective
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  const frustum = new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  )
  const reach = camera.far * camera.far
  const eye = camera.position
  const point = new Vector3()
  let inRange = 0
  let inFrustum = 0
  for (let at = 0; at < centres.length; at += 3) {
    point.set(centres[at] ?? 0, centres[at + 1] ?? 0, centres[at + 2] ?? 0)
    if (point.distanceToSquared(eye) <= reach) inRange += 1
    if (frustum.containsPoint(point)) inFrustum += 1
  }
  return { inRange, inFrustum }
}

/**
 * Ce qu'un scénario a coûté. Les comptes se prennent en MÉDIANE et en MAXIMUM sur toutes les
 * frames, jamais sur la dernière : une rotation d'un tour complet finit là où elle a commencé.
 */
const fold = (prefix: string, ticks: Tick[]): Numbers => {
  const cpu = ticks.map(tick => tick.cpu)
  const gpu = ticks.flatMap(tick => tick.gpu)
  const calls = ticks.map(tick => tick.calls)
  const triangles = ticks.map(tick => tick.triangles)
  const instances = ticks.map(tick => tick.instances)
  return {
    [`${prefix}CpuMeanMs`]: round(mean(cpu)),
    [`${prefix}CpuPeakMs`]: round(top(cpu)),
    [`${prefix}CpuMedianMs`]: round(median(cpu)),
    [`${prefix}GpuMs`]: gpu.length > 0 ? round(median(gpu)) : null,
    [`${prefix}GpuPeakMs`]: gpu.length > 0 ? round(top(gpu)) : null,
    [`${prefix}Calls`]: Math.round(median(calls)),
    [`${prefix}CallsPeak`]: top(calls),
    [`${prefix}Triangles`]: Math.round(median(triangles)),
    [`${prefix}TrianglesPeak`]: top(triangles),
    [`${prefix}Instances`]: Math.round(median(instances)),
    [`${prefix}InstancesPeak`]: top(instances),
  }
}

export type Step = { count: number; spread: WorldSpread; phase: string }

/** La caméra posée au sol, regardant l'horizon dans l'axe des x. */
const walking = (at: number): CameraPlacement => ({
  position: { x: at, y: EYES, z: 0 },
  target: { x: at + 1, y: EYES, z: 0 },
})

/** La même, tournée sur place : la vue change entièrement sans qu'un seul corps ne bouge. */
const spinning = (at: number, angle: number): CameraPlacement => ({
  position: { x: at, y: EYES, z: 0 },
  target: { x: at + Math.cos(angle), y: EYES, z: Math.sin(angle) },
})

async function measureOne(
  count: number,
  spread: WorldSpread,
  level: ShapeLevel,
  far: number,
  onProgress?: (step: Step) => void,
): Promise<Numbers> {
  const progress = (phase: string): void => onProgress?.({ count, spread, phase })
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

  // 🛑 `dispose` sous `finally` : un jet après la construction laissait un contexte WebGL et un
  // monde de 500 000 nœuds en vie, `runWorldBench` continuant sa boucle. Quelques combinaisons
  // ratées suffisaient à épuiser les contextes de Chromium et à faire échouer tout le reste.
  try {
    renderer.prepareOffscreen({ alpha: false, pixelRatio: 1 })
    renderer.mount(host)
    renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: true })
    const canvas = host.querySelector('canvas')
    if (!canvas) throw new Error('the engine mounted no canvas')

    progress('construction du monde')
    const plan = { ...DEFAULT_PLAN, count, spread, level }
    const state = openWorld(plan)
    const shape = worldShape(state, plan)
    const centres = centresOf(state)

    progress('apply')
    const startedApply = performance.now()
    renderer.apply(state)
    const applyMs = performance.now() - startedApply

    const span = spanFor(count)
    const camera = renderer['viewport'].perspective
    // La ZONE ACTIVE du balayage C5-B0. Le défaut du produit est 1 000 (`ViewportEngine`), et
    // c'est ce qu'on lit quand rien n'est demandé.
    camera.far = far
    camera.updateProjectionMatrix()

    aim(renderer, walking(-span * 0.6))
    for (let frame = 0; frame < WARMUP; frame += 1) await nextFrame()
    const regions = regionsOf(renderer['viewport'].scene)
    const sun = sunOf(renderer['viewport'].scene)
    if (!sun) throw new Error('the world carries no shadow-casting sun')
    if (SHADOW_DEPTH === 'fit') {
      sun.shadow.camera.near = 0.5
      sun.shadow.camera.far = Math.hypot(sun.position.x, sun.position.y, sun.position.z) + span * 3
      sun.shadow.camera.updateProjectionMatrix()
    }

    progress('repos')
    const restActive = activeSet(centres, renderer)
    const rest = await runScenario(renderer, canvas, REST_FRAMES, () => null)
    const restSettled = await settledCosts(renderer, 'rest')

    progress('marche')
    aim(renderer, walking(-span * 0.6))
    const walk = await runScenario(renderer, canvas, MOVE_FRAMES, frame => walking(-span * 0.6 + frame * 0.05))
    const walkSettled = await settledCosts(renderer, 'walk')

    progress('course')
    aim(renderer, walking(-span * 0.9))
    const run = await runScenario(renderer, canvas, MOVE_FRAMES, frame => walking(-span * 0.9 + frame * 1))
    const runSettled = await settledCosts(renderer, 'run')

    progress('rotation')
    aim(renderer, walking(0))
    const spin = await runScenario(renderer, canvas, SPIN_FRAMES, frame =>
      spinning(0, (frame / SPIN_FRAMES) * Math.PI * 2),
    )
    const spinSettled = await settledCosts(renderer, 'spin')

    progress('téléportation')
    aim(renderer, walking(-span * 0.9))
    await runScenario(renderer, canvas, 60, () => null)
    const teleport = await runScenario(renderer, canvas, TELEPORT_FRAMES, frame =>
      frame === 0 ? walking(span * 0.9) : null,
    )
    const teleportSettled = await settledCosts(renderer, 'teleport')

    // 🛑 La vue haute se pose à `far × 0,45`, jamais à `span × 0,5` : à 500 000 la caméra se
    // retrouvait à 1 341 de l'origine pour un plan lointain de 1 000, donc elle mesurait un
    // CLIPPING pendant que le relevé la présentait comme la vue qui ne rejette rien.
    progress('vue haute')
    const highAt = far * 0.45
    aim(renderer, { position: { x: 0, y: highAt, z: highAt }, target: { x: 0, y: 0, z: 0 } })
    const highActive = activeSet(centres, renderer)
    const high = await runScenario(renderer, canvas, REST_FRAMES, () => null)
    const highSettled = await settledCosts(renderer, 'high')

    return {
      count,
      spread,
      level,
      far,
      trianglesPerRegion: TRIANGLES_PER_REGION,
      shadowDepth: SHADOW_DEPTH,
      shadowFar: round(sun.shadow.camera.far),
      shadowSide: round(sun.shadow.camera.right - sun.shadow.camera.left),
      // 🛑 Relevée, jamais déduite : `configure` repose le ratio à `pixelRatioFor(quality)`, donc
      // le `pixelRatio: 1` demandé plus haut ne survit pas. Un rapport qui écrit sa résolution de
      // mémoire se trompe — celui de C5-A annonçait 1600×900 pour un tampon de 2400×1350.
      bufferWidth: canvas.width,
      bufferHeight: canvas.height,
      pixelRatio: round(canvas.width / WIDTH),
      span: shape.span,
      tiles: shape.tiles,
      landmarks: shape.landmarks,
      props: shape.props,
      clusters: shape.clusters,
      bodies: shape.tiles + shape.landmarks + shape.props,
      applyMs: round(applyMs),
      regions,
      restInRange: restActive.inRange,
      restInFrustum: restActive.inFrustum,
      highInRange: highActive.inRange,
      highInFrustum: highActive.inFrustum,
      ...fold('rest', rest),
      ...restSettled,
      ...fold('walk', walk),
      ...walkSettled,
      ...fold('run', run),
      ...runSettled,
      ...fold('spin', spin),
      ...spinSettled,
      ...fold('teleport', teleport),
      ...teleportSettled,
      ...fold('high', high),
      ...highSettled,
    }
  } finally {
    renderer.dispose()
    host.remove()
    texture.dispose()
    await pause(400)
  }
}

const partial = (report: { results: Numbers[]; failures: unknown[] }): void => {
  // `as`: le banc dépose son état sur la fenêtre, que `run.mjs` lit par CDP. Rien ne le type.
  ;(globalThis as unknown as { __partial: unknown }).__partial = report
}

export async function runWorldBench(
  onProgress?: (step: Step) => void,
): Promise<{ results: Numbers[]; failures: unknown[] }> {
  const counts = numbersOf('counts', [50_000])
  const spreads = oneOf('spreads', WORLD_SPREADS, 'uniform')
  const level = oneOf('lod', SHAPE_LEVELS, 'product')[0] ?? 'product'
  // 1 000 est le plan lointain que `ViewportEngine` pose par défaut : la zone active du produit.
  const fars = numbersOf('fars', [1000])
  const order = QUERY.get('order') === 'reversed'
  const results: Numbers[] = []
  const failures: unknown[] = []
  for (const count of order ? [...counts].reverse() : counts) {
    for (const spread of order ? [...spreads].reverse() : spreads) {
      for (const far of order ? [...fars].reverse() : fars) {
        try {
          results.push(await measureOne(count, spread, level, far, onProgress))
        } catch (error) {
          failures.push({ count, spread, far, error: String(error), stack: String((error as Error)?.stack ?? '') })
        }
        partial({ results, failures })
      }
    }
  }
  return { results, failures }
}
