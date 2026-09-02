import { DirectionalLight, Group, InstancedMesh, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { CameraPlacement } from '@/engines/scene/sceneView'
import { TRIANGLES_PER_REGION } from '@/engines/scene/instanceRegions'
import { createGlTimer, type GlTimer } from './glTimer.js'
import { checker } from './floorScenes.js'
import { DEFAULT_PLAN, openWorld, spanFor, worldShape, WORLD_SPREADS, type WorldSpread } from './openWorld'
import type { ShapeLevel } from './engineScenes'

/**
 * C5-A : ce que coûte un monde ouvert vu depuis dedans, et C5-B (a) : ce que le grain de région
 * déjà en production y rejette.
 *
 * 🛑 Ce banc ne change RIEN au moteur. Le balayage du grain se fait en modifiant
 * `TRIANGLES_PER_REGION` entre deux lancements, comme C2 le faisait — la constante est relue et
 * écrite dans chaque relevé, pour qu'un fichier dise de lui-même sous quel grain il a été pris.
 */

const WIDTH = 1600
const HEIGHT = 900
const WARMUP = 20
/** Le repos se lit sur des centaines de frames, jamais sur une poignée. */
const REST_FRAMES = 240
const MOVE_FRAMES = 300
const SPIN_FRAMES = 180
const TELEPORT_FRAMES = 180
/** Blocs de quinze : `performance.now()` est clampé à 100 µs et une passe passe dessous. */
const BLOCKS = 10
const FRAMES = 15
/** Ce qu'une caméra posée au sol a comme hauteur d'yeux. */
const EYES = 1.7

const QUERY = new URLSearchParams(location.search)
/** `default` laisse la carte d'ombre telle que le studio la pose ; `fit` en ouvre la profondeur. */
const SHADOW_DEPTH = QUERY.get('shadowDepth') ?? 'default'

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

type Numbers = Record<string, number | string | null>

/**
 * Ce que le contexte a vraiment dessiné. Les INSTANCES en plus des appels : c'est la seule
 * colonne qui dit « objets dessinés », et un rejet de région se lit là avant de se lire ailleurs.
 */
const counted = { calls: 0, triangles: 0, instances: 0 }
{
  const proto = WebGL2RenderingContext.prototype
  const TRIANGLES = WebGL2RenderingContext.TRIANGLES
  const drawElements = proto.drawElements
  proto.drawElements = function (mode, count, type, offset) {
    counted.calls += 1
    if (mode === TRIANGLES) {
      counted.triangles += count / 3
      counted.instances += 1
    }
    return drawElements.call(this, mode, count, type, offset)
  }
  const drawElementsInstanced = proto.drawElementsInstanced
  proto.drawElementsInstanced = function (mode, count, type, offset, instances) {
    counted.calls += 1
    if (mode === TRIANGLES) {
      counted.triangles += (count / 3) * instances
      counted.instances += instances
    }
    return drawElementsInstanced.call(this, mode, count, type, offset, instances)
  }
  // Une forme sans index passerait par là : comptée pour qu'un monde ne se lise jamais trop léger.
  const drawArraysInstanced = proto.drawArraysInstanced
  proto.drawArraysInstanced = function (mode, first, count, instances) {
    counted.calls += 1
    if (mode === TRIANGLES) {
      counted.triangles += (count / 3) * instances
      counted.instances += instances
    }
    return drawArraysInstanced.call(this, mode, first, count, instances)
  }
}

/** Le soleil de la scène : c'est sa carte que le banc redessine, et lui seul en porte une. */
function sunOf(root: { traverse: (visit: (object: unknown) => void) => void }): DirectionalLight | null {
  let found: DirectionalLight | null = null
  root.traverse(object => {
    if (object instanceof DirectionalLight && object.castShadow) found = object
  })
  return found
}

/** Combien d'`InstancedMesh` la scène porte : ce que le frustum a À CONSIDÉRER, une sphère chacun. */
function regionsOf(root: { traverse: (visit: (object: unknown) => void) => void }): number {
  let many = 0
  root.traverse(object => {
    if (object instanceof InstancedMesh) many += 1
  })
  return many
}

type Drawn = { cpu: number; calls: number; triangles: number; instances: number }

const snapshot = (): { calls: number; triangles: number; instances: number } => ({ ...counted })

/**
 * Une frame, dessinée par NOUS et chronométrée autour de l'appel.
 *
 * 🛑 Deux motifs à base de `requestAnimationFrame` ont été essayés et jetés. Chronométrer
 * `redraw()` mesure le coût de poser un drapeau — 0,013 ms sur un monde de 3,5 M de triangles.
 * Remettre les compteurs à zéro dans un rappel et lire dans le suivant, comme `engineBench`, ne
 * tient que sur une vue FIXE : dès que la caméra bouge, `schedule()` garde une frame en vol, le
 * dessin passe avant la remise à zéro, et le banc lit zéro instance et zéro GPU. Lire par
 * différence sur deux rappels marchait mais captait 1,5 frame, gonflant tout de moitié.
 *
 * `drawFrom` est SYNCHRONE : rien ne peut s'intercaler entre les deux lectures, l'ordre des
 * rappels ne compte plus, et le chronomètre encadre exactement un dessin. Ce que le studio met
 * autour et que ceci ne mesure pas — le post, l'incrustation, l'atelier — est écrit au rapport.
 */
function drawOnce(renderer: SceneRenderer, withShadow: boolean): Drawn {
  // 🛑 Le viewport pose `shadowMap.autoUpdate = false`, donc three ne redessine la carte que sur
  // `shadowMap.needsUpdate` du RENDERER — `light.shadow.needsUpdate` ne suffit pas, et le banc
  // lisait une passe d'ombre sur une frame par deux, zéro appel d'ombre en médiane.
  //
  // Le studio ne la redessine PAS quand seule la caméra bouge (`requestCameraRender`). Un volume
  // d'ombre ajusté sur la VUE l'exigerait à chaque mouvement : ce que ce drapeau force est donc
  // le coût que C4 ajouterait, et il se lit ici plutôt qu'il ne se devine.
  const gl = renderer['viewport'].gl
  if (gl) gl.shadowMap.needsUpdate = withShadow
  const before = snapshot()
  const started = performance.now()
  renderer.drawFrom(null, 0)
  const cpu = performance.now() - started
  return {
    cpu,
    calls: counted.calls - before.calls,
    triangles: Math.round(counted.triangles - before.triangles),
    instances: counted.instances - before.instances,
  }
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
    if (placement) renderer.placeView(placement)
    timer?.begin()
    const drawn = drawOnce(renderer, true)
    timer?.end()
    await nextFrame()
    ticks.push({ ...drawn, gpu: timer?.collect() ?? [] })
  }
  timer?.dispose()
  return ticks
}

/**
 * Ce que la scène coûte, caméra FIGÉE là où le scénario l'a laissée : le CPU sur des blocs de
 * quinze, puis la même vue sans rafraîchir l'ombre.
 *
 * `performance.now()` est clampé à 100 µs, donc une passe sous la milliseconde ne se lit que sur
 * un bloc. La part d'ombre se prend par DIFFÉRENCE avec une frame qui ne la redessine pas — rien
 * dans WebGL ne dit à quelle passe un appel appartient, et c'est ce que C2 et C4 faisaient déjà.
 */
async function settledCosts(renderer: SceneRenderer): Promise<Numbers> {
  const withShadow: number[] = []
  for (let block = 0; block < BLOCKS; block += 1) {
    const started = performance.now()
    for (let frame = 0; frame < FRAMES; frame += 1) drawOnce(renderer, true)
    withShadow.push((performance.now() - started) / FRAMES)
    await nextFrame()
  }
  const lit = drawOnce(renderer, true)

  const bareBlocks: number[] = []
  for (let block = 0; block < BLOCKS; block += 1) {
    const started = performance.now()
    for (let frame = 0; frame < FRAMES; frame += 1) drawOnce(renderer, false)
    bareBlocks.push((performance.now() - started) / FRAMES)
    await nextFrame()
  }
  const bare = drawOnce(renderer, false)

  return {
    scenePassCpuMs: round(median(withShadow)),
    colourPassCpuMs: round(median(bareBlocks)),
    colourCalls: bare.calls,
    colourTriangles: bare.triangles,
    colourInstances: bare.instances,
    shadowCalls: lit.calls - bare.calls,
    shadowTriangles: lit.triangles - bare.triangles,
    shadowInstances: lit.instances - bare.instances,
  }
}

/**
 * Ce qu'un scénario a coûté. Les comptes de dessin se prennent en MÉDIANE et en MAXIMUM sur toutes
 * les frames, jamais sur la dernière : une rotation d'un tour complet finit là où elle a commencé,
 * et la dernière frame d'un tour rendait exactement le relevé du repos.
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

const prefixed = (prefix: string, numbers: Numbers): Numbers =>
  Object.fromEntries(Object.entries(numbers).map(([key, value]) => [`${prefix}${key[0]?.toUpperCase()}${key.slice(1)}`, value]))

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
  renderer.prepareOffscreen({ alpha: false, pixelRatio: 1 })
  renderer.mount(host)
  renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: true })
  const canvas = host.querySelector('canvas')
  if (!canvas) throw new Error('the engine mounted no canvas')

  progress('construction du monde')
  const plan = { ...DEFAULT_PLAN, count, spread, level }
  const state = openWorld(plan)
  const shape = worldShape(state, plan)

  progress('apply')
  const startedApply = performance.now()
  renderer.apply(state)
  const applyMs = performance.now() - startedApply

  const span = spanFor(count)
  renderer.placeView(walking(-span * 0.6))
  for (let frame = 0; frame < WARMUP; frame += 1) await nextFrame()
  const regions = regionsOf(renderer['viewport'].scene)
  const sun = sunOf(renderer['viewport'].scene)
  if (!sun) throw new Error('the world carries no shadow-casting sun')
  // `shadowDepth=fit` ouvre la seule PROFONDEUR de la carte, jusqu'à ce que la scène occupe. Rien
  // d'autre ne bouge : ni les côtés que `fitShadowCamera` pose, ni la lumière, ni le document.
  // C'est ce que le studio dessinerait si `far` n'était pas resté au défaut de three, et sans
  // cette colonne la passe d'ombre du produit se lit sans qu'on sache ce qu'elle omet.
  if (SHADOW_DEPTH === 'fit') {
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = Math.hypot(sun.position.x, sun.position.y, sun.position.z) + span * 3
    sun.shadow.camera.updateProjectionMatrix()
  }

  progress('repos')
  const rest = await runScenario(renderer, canvas, REST_FRAMES, () => null)
  const restSettled = await settledCosts(renderer)

  progress('marche')
  renderer.placeView(walking(-span * 0.6))
  const walk = await runScenario(renderer, canvas, MOVE_FRAMES, frame => walking(-span * 0.6 + frame * 0.05))
  const walkSettled = await settledCosts(renderer)

  progress('course')
  renderer.placeView(walking(-span * 0.9))
  const run = await runScenario(renderer, canvas, MOVE_FRAMES, frame => walking(-span * 0.9 + frame * 1))
  const runSettled = await settledCosts(renderer)

  progress('rotation')
  renderer.placeView(walking(0))
  const spin = await runScenario(renderer, canvas, SPIN_FRAMES, frame =>
    spinning(0, (frame / SPIN_FRAMES) * Math.PI * 2),
  )
  const spinSettled = await settledCosts(renderer)

  progress('téléportation')
  renderer.placeView(walking(-span * 0.9))
  await runScenario(renderer, canvas, 60, () => null)
  const teleport = await runScenario(renderer, canvas, TELEPORT_FRAMES, frame =>
    frame === 0 ? walking(span * 0.9) : null,
  )
  const teleportSettled = await settledCosts(renderer)

  // La vue haute : celle où une partition n'a presque rien à rejeter. Référence honnête, pas un
  // scénario favorable — sans elle le gain se lirait sur les seules vues qui l'avantagent.
  progress('vue haute')
  renderer.placeView({
    position: { x: 0, y: span * 0.5, z: span * 0.5 },
    target: { x: 0, y: 0, z: 0 },
  })
  const high = await runScenario(renderer, canvas, REST_FRAMES, () => null)
  const highSettled = await settledCosts(renderer)

  renderer.dispose()
  host.remove()
  texture.dispose()
  await pause(400)

  return {
    count,
    spread,
    level,
    trianglesPerRegion: TRIANGLES_PER_REGION,
    shadowDepth: SHADOW_DEPTH,
    shadowFar: round(sun.shadow.camera.far),
    shadowSide: round(sun.shadow.camera.right - sun.shadow.camera.left),
    span: shape.span,
    tiles: shape.tiles,
    landmarks: shape.landmarks,
    props: shape.props,
    clusters: shape.clusters,
    bodies: shape.tiles + shape.landmarks + shape.props,
    applyMs: round(applyMs),
    regions,
    ...fold('rest', rest),
    ...prefixed('rest', restSettled),
    ...fold('walk', walk),
    ...prefixed('walk', walkSettled),
    ...fold('run', run),
    ...prefixed('run', runSettled),
    ...fold('spin', spin),
    ...prefixed('spin', spinSettled),
    ...fold('teleport', teleport),
    ...prefixed('teleport', teleportSettled),
    ...fold('high', high),
    ...prefixed('high', highSettled),
  }
}

const partial = (report: { results: Numbers[]; failures: unknown[] }): void => {
  // `as`: le banc dépose son état sur la fenêtre, que `run.mjs` lit par CDP. Rien ne le type.
  ;(globalThis as unknown as { __partial: unknown }).__partial = report
}

export async function runWorldBench(
  onProgress?: (step: Step) => void,
): Promise<{ results: Numbers[]; failures: unknown[] }> {
  const counts = (QUERY.get('counts') ?? '50000').split(',').map(Number)
  const spreads = (QUERY.get('spreads') ?? WORLD_SPREADS.join(',')).split(',') as WorldSpread[]
  const level = (QUERY.get('lod') ?? 'product') as ShapeLevel
  const order = QUERY.get('order') === 'reversed'
  const results: Numbers[] = []
  const failures: unknown[] = []
  for (const count of order ? [...counts].reverse() : counts) {
    for (const spread of order ? [...spreads].reverse() : spreads) {
      try {
        results.push(await measureOne(count, spread, level, onProgress))
      } catch (error) {
        failures.push({ count, spread, error: String(error), stack: String((error as Error)?.stack ?? '') })
      }
      partial({ results, failures })
    }
  }
  return { results, failures }
}
