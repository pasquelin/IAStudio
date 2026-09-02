import { BatchedMesh, Group, PerspectiveCamera, Vector3, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer, type GroupingStrategy } from '@/engines/scene/SceneRenderer'
import type { CameraPlacement } from '@/engines/scene/sceneView'
import type { SceneState } from '@/engines/scene/sceneState'
import { createGlTimer, type GlTimer } from './glTimer.js'
import { centresOf, sceneS1, sceneVaried, withBodyMoved, withNothingMoved, withOneAdded, withOneMoved, withoutMaps } from './engineScenes'
import { checker } from './floorScenes.js'

/**
 * Le banc du chantier C : le VRAI `SceneRenderer`, monté sur une fenêtre, mesuré des deux côtés
 * du flag `grouping`. Aucun mesh n'est construit ici — `apply` fait tout.
 *
 * 🛑 `performance.now()` est clampé à 100 µs dans une page non isolée : le CPU de rendu se prend
 * sur un bloc de quinze frames, jamais sur une seule.
 */

const WIDTH = 1600
const HEIGHT = 900
const WARMUP = 30
const BLOCKS = 10
const FRAMES = 15
const FPS_FRAMES = 120
const EDITS = 100
const APPLY_PASSES = 12

type Point = { x: number; y: number; z: number }
type Numbers = Record<string, number | string | null>

/** Ce que l'URL de la page demande : scènes, ordre, chemins, et les interrupteurs de ventilation. */
const QUERY = new URLSearchParams(location.search)

const nextFrame = (): Promise<number> => new Promise(resolve => requestAnimationFrame(resolve))
const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))
const round = (value: number): number => Math.round(value * 1000) / 1000
const median = (values: number[]): number => {
  const sorted = [...values].sort((one, other) => one - other)
  return sorted.length === 0 ? 0 : (sorted[Math.floor(sorted.length / 2)] ?? 0)
}
const heapMb = (): number | null => {
  // `memory` n'est pas standard : Chromium seul le publie.
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
  return memory ? round(memory.usedJSHeapSize / 1e6) : null
}

/**
 * Les appels de dessin, comptés sur le CONTEXTE plutôt que sur `renderer.info` : le
 * `WebGLRenderer` du moteur est privé, et `render` y est une propriété d'instance, donc rien
 * sur le prototype ne l'attrape. Le contexte, lui, est celui du canvas — le même objet.
 */
const counted = { calls: 0, multi: 0, instanced: 0, plain: 0, triangles: 0, multiDrawn: 0, instancedDrawn: 0 }
const resetCount = (): void => {
  counted.calls = 0
  counted.multi = 0
  counted.instanced = 0
  counted.plain = 0
  counted.triangles = 0
  counted.multiDrawn = 0
  counted.instancedDrawn = 0
}
{
  const proto = WebGL2RenderingContext.prototype
  const TRIANGLES = WebGL2RenderingContext.TRIANGLES
  const drawElements = proto.drawElements
  proto.drawElements = function (mode, count, type, offset) {
    counted.calls++
    counted.plain++
    if (mode === TRIANGLES) counted.triangles += count / 3
    return drawElements.call(this, mode, count, type, offset)
  }
  const drawArrays = proto.drawArrays
  proto.drawArrays = function (mode, first, count) {
    counted.calls++
    counted.plain++
    if (mode === TRIANGLES) counted.triangles += count / 3
    return drawArrays.call(this, mode, first, count)
  }
  const drawElementsInstanced = proto.drawElementsInstanced
  proto.drawElementsInstanced = function (mode, count, type, offset, instances) {
    counted.calls++
    counted.instanced++
    counted.instancedDrawn += instances
    if (mode === TRIANGLES) counted.triangles += (count / 3) * instances
    return drawElementsInstanced.call(this, mode, count, type, offset, instances)
  }
  const drawArraysInstanced = proto.drawArraysInstanced
  proto.drawArraysInstanced = function (mode, first, count, instances) {
    counted.calls++
    counted.instanced++
    counted.instancedDrawn += instances
    if (mode === TRIANGLES) counted.triangles += (count / 3) * instances
    return drawArraysInstanced.call(this, mode, first, count, instances)
  }
  type Counts = Int32Array | number[]
  type MultiDraw = {
    multiDrawElementsWEBGL: (mode: number, counts: Counts, countsOffset: number, type: number, offsets: Counts, offsetsOffset: number, drawcount: number) => void
    multiDrawArraysWEBGL: (mode: number, firsts: Counts, firstsOffset: number, counts: Counts, countsOffset: number, drawcount: number) => void
  }
  // `as` : les surcharges typées de `getExtension` refusent un nom quelconque.
  const getExtension = proto.getExtension as (this: WebGL2RenderingContext, name: string) => unknown
  const wrapped = new WeakSet<object>()
  // `as` : les typages WebGL2 ignorent `WEBGL_multi_draw`, que three lit pourtant par ce nom.
  const patchedGetExtension = function (this: WebGL2RenderingContext, name: string): unknown {
    const extension = getExtension.call(this, name)
    if (name === 'WEBGL_multi_draw' && extension && typeof extension === 'object' && !wrapped.has(extension)) {
      const multi = extension as MultiDraw
      const multiElements = multi.multiDrawElementsWEBGL
      multi.multiDrawElementsWEBGL = function (mode, counts, countsOffset, type, offsets, offsetsOffset, drawcount) {
        counted.calls++
        counted.multi++
        counted.multiDrawn += drawcount
        if (mode === TRIANGLES) {
          for (let at = 0; at < drawcount; at++) counted.triangles += (counts[countsOffset + at] ?? 0) / 3
        }
        return multiElements.call(this, mode, counts, countsOffset, type, offsets, offsetsOffset, drawcount)
      }
      const multiArrays = multi.multiDrawArraysWEBGL
      multi.multiDrawArraysWEBGL = function (mode, firsts, firstsOffset, counts, countsOffset, drawcount) {
        counted.calls++
        counted.multi++
        counted.multiDrawn += drawcount
        if (mode === TRIANGLES) {
          for (let at = 0; at < drawcount; at++) counted.triangles += (counts[countsOffset + at] ?? 0) / 3
        }
        return multiArrays.call(this, mode, firsts, firstsOffset, counts, countsOffset, drawcount)
      }
      wrapped.add(extension)
    }
    return extension
  }
  proto.getExtension = patchedGetExtension as typeof proto.getExtension
}

/**
 * Deux interrupteurs de VENTILATION, `sort=off` et `cull=off` : le moteur pose les deux drapeaux
 * sur chaque lot, et le banc les rabat juste avant que three ne les lise. C'est la seule façon de
 * dire où part le temps d'un lot sans toucher au code de production.
 */
{
  const sort = QUERY.get('sort') !== 'off'
  const cull = QUERY.get('cull') !== 'off'
  if (!sort || !cull) {
    const onBeforeRender = BatchedMesh.prototype.onBeforeRender
    BatchedMesh.prototype.onBeforeRender = function patched(this: BatchedMesh, ...args) {
      this.sortObjects = sort
      this.perObjectFrustumCulled = cull
      return onBeforeRender.apply(this, args)
    }
  }
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

/** La part des centres qu'une caméra tient dans son champ, en NDC. */
function shareInView(placement: CameraPlacement, centres: Point[], fov: number): number {
  const camera = new PerspectiveCamera(fov, WIDTH / HEIGHT, 0.1, 5000)
  camera.position.set(placement.position.x, placement.position.y, placement.position.z)
  camera.lookAt(placement.target.x, placement.target.y, placement.target.z)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  const point = new Vector3()
  let inside = 0
  for (const centre of centres) {
    point.set(centre.x, centre.y, centre.z).project(camera)
    if (Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && point.z >= -1 && point.z <= 1) inside++
  }
  return inside / Math.max(1, centres.length)
}

/**
 * La même position, la visée tournée autour de l'axe vertical jusqu'à ce que 30 % des corps
 * restent dans le champ — par bissection sur l'angle, la part décroissant avec lui.
 */
function turnedAway(full: CameraPlacement, centres: Point[], fov: number, want = 0.3): { placement: CameraPlacement; share: number } {
  const forward = new Vector3(full.target.x - full.position.x, full.target.y - full.position.y, full.target.z - full.position.z)
  const at = (angle: number): CameraPlacement => {
    const turned = forward.clone().applyAxisAngle(new Vector3(0, 1, 0), angle)
    return { position: full.position, target: { x: full.position.x + turned.x, y: full.position.y + turned.y, z: full.position.z + turned.z } }
  }
  let low = 0
  let high = Math.PI
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2
    if (shareInView(at(middle), centres, fov) > want) low = middle
    else high = middle
  }
  const placement = at((low + high) / 2)
  return { placement, share: shareInView(placement, centres, fov) }
}

type View = 'full' | 'turned'

type Frame = { cpu: number; calls: number; multi: number; instanced: number; plain: number; triangles: number; multiDrawn: number; instancedDrawn: number }

/**
 * UNE frame telle que le studio la dessine — passe d'ombre, panneaux, post, trihèdre — et ce
 * qu'elle a coûté au CPU. `redraw` est privé au sens de TypeScript seulement ; c'est la porte
 * par laquelle chaque édition demande sa frame, donc la seule qui mesure le produit.
 *
 * Trois rappels dans la même frame, dans l'ordre d'inscription : le nôtre qui remet les
 * compteurs à zéro, celui du viewport qui dessine, le nôtre qui lit l'horloge — l'horodatage du
 * rappel est le début de la frame, `performance.now()` est l'après-dessin.
 */
function frameOf(renderer: SceneRenderer, timer: GlTimer | null): Promise<Frame> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resetCount()
      timer?.begin()
    })
    renderer['redraw']()
    requestAnimationFrame(started => {
      const cpu = performance.now() - started
      timer?.end()
      resolve({ cpu, ...counted })
    })
  })
}

/**
 * Le plafond de ce qu'une DISTANCE MAX rendrait, mesuré par le plan lointain de la caméra.
 *
 * Ce que trois fait déjà : un objet dont la sphère tombe derrière `far` sort du frustum et n'est
 * pas dessiné. Ce n'est pas une distance max livrée — la passe d'ombre garde la sienne, et rien
 * ne s'estompe au bord — mais c'est ce qu'elle pourrait couper.
 *
 * 🛑 Il ne mesure RIEN sur les deux vues de ce banc : toutes deux cadrent le niveau depuis le
 * DEHORS, donc le plan lointain garde tout ou couperait tout. À 80 m sur S3 il rend 97 086 corps
 * sur 100 000, et la vue tournée ne bouge pas d'un triangle. Il attend une vue prise DANS le
 * niveau, que ce banc n'a pas.
 */
function clampFar(renderer: SceneRenderer, metres: number): void {
  if (metres <= 0) return
  const viewport = renderer['viewport'] as unknown as { perspective: PerspectiveCamera; paneCameras: PerspectiveCamera[] }
  for (const camera of [viewport.perspective, ...viewport.paneCameras]) {
    camera.far = metres
    camera.updateProjectionMatrix()
  }
}

async function measureView(renderer: SceneRenderer, canvas: HTMLCanvasElement, view: View): Promise<Numbers> {
  const gl = canvas.getContext('webgl2')
  const timer = gl ? createGlTimer(gl) : null
  clampFar(renderer, Number(QUERY.get('far') ?? 0))

  // Une frame que quelqu'un d'autre a demandée finirait devant nos rappels : on la laisse passer.
  await nextFrame()
  await nextFrame()
  for (let frame = 0; frame < WARMUP; frame++) await frameOf(renderer, timer)
  timer?.collect()

  const cpu: number[] = []
  const wall: number[] = []
  const gpu: number[] = []
  let last = performance.now()
  let counts: Frame | null = null
  for (let frame = 0; frame < FPS_FRAMES; frame++) {
    counts = await frameOf(renderer, timer)
    const now = performance.now()
    cpu.push(counts.cpu)
    wall.push(now - last)
    last = now
    gpu.push(...(timer?.collect() ?? []))
  }
  for (let frame = 0; frame < 4; frame++) {
    await nextFrame()
    gpu.push(...(timer?.collect() ?? []))
  }

  // La passe de scène SEULE, sans ombre ni post, sur un bloc : `performance.now()` est clampé à
  // 100 µs et une frame de S1 passe sous ce tick.
  const scenePass: number[] = []
  for (let block = 0; block < BLOCKS; block++) {
    const started = performance.now()
    for (let frame = 0; frame < FRAMES; frame++) renderer.drawFrom(null, 0)
    scenePass.push((performance.now() - started) / FRAMES)
    await nextFrame()
  }
  timer?.dispose()

  const prefix = view
  return {
    [`${prefix}FrameCpuMs`]: round(median(cpu)),
    [`${prefix}ScenePassCpuMs`]: round(median(scenePass)),
    [`${prefix}FrameMs`]: round(median(wall)),
    [`${prefix}Fps`]: round(1000 / median(wall)),
    [`${prefix}GpuMs`]: gpu.length > 0 ? round(median(gpu)) : null,
    [`${prefix}DrawCalls`]: counts?.calls ?? null,
    [`${prefix}MultiDrawCalls`]: counts?.multi ?? null,
    [`${prefix}InstancedCalls`]: counts?.instanced ?? null,
    [`${prefix}PlainCalls`]: counts?.plain ?? null,
    [`${prefix}BodiesByLot`]: counts?.multiDrawn ?? null,
    [`${prefix}BodiesByInstance`]: counts?.instancedDrawn ?? null,
    [`${prefix}Triangles`]: counts ? Math.round(counts.triangles) : null,
  }
}

const timed = (times: number, run: (at: number) => void): number => {
  const samples: number[] = []
  for (let at = 0; at < times; at++) {
    const started = performance.now()
    run(at)
    samples.push(performance.now() - started)
  }
  return round(median(samples))
}

export type SceneName = 'S1' | 'S2' | 'S3'

const SCENES: Record<SceneName, () => SceneState> = {
  S1: sceneS1,
  S2: () => sceneVaried(10_000),
  S3: () => sceneVaried(50_000),
}

export type Step = { scene: SceneName; grouping: GroupingStrategy; phase: string }

async function measureOne(scene: SceneName, grouping: GroupingStrategy, onProgress?: (step: Step) => void): Promise<Numbers> {
  const progress = (phase: string): void => onProgress?.({ scene, grouping, phase })
  progress('construction')
  const host = hostOf()
  const texture: Texture = checker()
  const heapBefore = heapMb()

  const renderer = new SceneRenderer({
    onSelect: () => {},
    onTransform: () => {},
    grouping,
    loadModel: async () => new Group(),
    loadTexture: async () => texture,
  })
  renderer.prepareOffscreen({ alpha: false, pixelRatio: 1 })
  renderer.mount(host)
  renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: QUERY.get('shadows') !== 'off' })
  const canvas = host.querySelector('canvas')
  if (!canvas) throw new Error('the engine mounted no canvas')

  const built = SCENES[scene]()
  const state = QUERY.get('maps') === 'off' ? withoutMaps(built) : built
  const opened = performance.now()
  renderer.apply(state)
  const firstApplyMs = round(performance.now() - opened)
  renderer.frameContents()
  const full = renderer.viewPlacement()
  // La première frame compile les programmes et bâtit les cartes d'ombre : hors mesure.
  await frameOf(renderer, null)
  const heapLoaded = heapMb()

  progress('plein champ')
  const fullView = await measureView(renderer, canvas, 'full')

  progress('apply')
  const still = Array.from({ length: APPLY_PASSES }, () => withNothingMoved(state))
  const applyStillMs = timed(APPLY_PASSES, at => renderer.apply(still[at] ?? state))
  const moved = Array.from({ length: APPLY_PASSES }, (_unused, at) => withOneMoved(state, at))
  const applyOneMovedMs = timed(APPLY_PASSES, at => renderer.apply(moved[at] ?? state))
  const added = withOneAdded(state)
  const applyOneAddedMs = timed(1, () => renderer.apply(added))
  renderer.apply(state)

  progress('70 % hors champ')
  const centres = centresOf(state)
  const { placement, share } = turnedAway(full, centres, DEFAULT_SETTINGS.three.fieldOfView)
  renderer.placeView(placement)
  const turnedView = await measureView(renderer, canvas, 'turned')
  renderer.placeView(full)

  progress('100 éditions')
  // Cent corps différents, à dessein : c'est une session d'édition, pas la colonne « 1 bougé ».
  for (let at = 0; at < EDITS; at++) {
    renderer.apply(withBodyMoved(state, at))
    if (at % 10 === 0) await nextFrame()
  }
  await nextFrame()
  const heapEdited = heapMb()

  renderer.dispose()
  host.remove()
  texture.dispose()
  await pause(500)

  return {
    scene,
    grouping,
    bodies: centres.length,
    firstApplyMs,
    applyStillMs,
    applyOneMovedMs,
    applyOneAddedMs,
    ...fullView,
    turnedShareInView: round(share * 100),
    ...turnedView,
    heapBefore,
    heapLoaded,
    heapEdited,
  }
}

export async function runEngine(onProgress?: (step: Step) => void): Promise<{ results: unknown[]; failures: unknown[] }> {
  const scenes = (QUERY.get('scenes')?.split(',') ?? ['S1', 'S2', 'S3']).filter((name): name is SceneName => name in SCENES)
  const both: GroupingStrategy[] = QUERY.get('order') === 'reversed' ? ['batched', 'instanced'] : ['instanced', 'batched']
  const asked = QUERY.get('groupings')?.split(',')
  const groupings = asked ? both.filter(grouping => asked.includes(grouping)) : both
  const results: unknown[] = []
  const failures: unknown[] = []

  for (const scene of scenes) {
    for (const grouping of groupings) {
      try {
        results.push(await measureOne(scene, grouping, onProgress))
      } catch (error) {
        // `as` : ce qu'un `throw` porte n'est typé par personne ; on lit `stack` s'il existe.
        failures.push({ scene, grouping, error: String((error as { stack?: string }).stack ?? error) })
      }
      // `as` : `__partial` est le canal que `run.mjs` sonde ; rien ne le déclare côté page.
      ;(globalThis as { __partial?: unknown }).__partial = { results, failures }
    }
  }
  return { results, failures }
}
