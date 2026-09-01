/**
 * La boucle de mesure. Un cas = un backend + un scénario + un compte d'objets.
 *
 * Trois horloges, et il faut les trois pour répondre à la question posée :
 *   `cpuSync`   — la mise à jour de la scène AVANT tout appel au backend
 *   `cpuRender` — l'appel de rendu côté CPU, c'est-à-dire le backend lui-même
 *   `gpu`       — ce que la carte a réellement passé sur la frame
 *
 * 🛑 Le FPS est plafonné par le vsync — 120 Hz sur cet écran. Deux cas à 120 FPS ne se départagent
 * QUE par `cpuRender` et `gpu` ; lire le FPS seul ferait conclure à l'égalité partout.
 *
 * 🛑 Le temps GPU se prend dans une passe SÉPARÉE, et c'est une contrainte, pas un choix :
 * `resolveTimestampsAsync` doit être attendu frame par frame (le renderer ignore un second appel
 * tant que le premier n'est pas résolu), et cet await décalerait le temps mural — donc le FPS.
 */
import { CASES, buildCase, checker } from './scenes.js'
import { createGlTimer } from './glTimer.js'
import { heapBytes, rendererCounters, summarise } from './metrics.js'
import { buildWebglPost, buildWebgpuPost } from './postfx.js'

const WIDTH = 1600
const HEIGHT = 900
const WARMUP_FRAMES = 40
const MEASURED_FRAMES = 200
const GPU_FRAMES = 60

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

function freshCanvas() {
  const stage = document.querySelector('#stage')
  stage.replaceChildren()
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  canvas.style.width = `${WIDTH / 2}px`
  canvas.style.height = `${HEIGHT / 2}px`
  stage.append(canvas)
  return canvas
}

async function makeWebgl(canvas) {
  const { WebGLRenderer, PCFShadowMap } = await import('three')
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  // Ratio 1 des deux côtés : sinon on comparerait deux surfaces de pixels différentes.
  renderer.setPixelRatio(1)
  renderer.setSize(WIDTH, HEIGHT, false)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  const timer = createGlTimer(renderer.getContext())

  return {
    kind: 'webgl',
    renderer,
    hasGpuClock: !!timer,
    draw: draw => draw(),
    drawTimed: async draw => {
      timer.begin()
      draw()
      timer.end()
      await nextFrame()
      return timer.collect()
    },
    flushGpu: () => timer?.collect() ?? [],
    dispose: () => {
      timer?.dispose()
      renderer.dispose()
    },
  }
}

async function makeWebgpu(canvas) {
  const { WebGPURenderer, PCFShadowMap } = await import('three/webgpu')
  // `trackTimestamp` est une option de CONSTRUCTEUR : les files de requêtes sont bâties à l'init,
  // et l'attribut posé après coup laisse le renderer répondre « tracking is disabled ».
  const renderer = new WebGPURenderer({
    canvas,
    antialias: true,
    forceWebGL: false,
    trackTimestamp: true,
  })
  renderer.setPixelRatio(1)
  renderer.setSize(WIDTH, HEIGHT, false)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  await renderer.init()
  if (renderer.backend?.isWebGLBackend) throw new Error('WebGPURenderer est retombé sur WebGL')

  const clocked = renderer.hasFeature('timestamp-query')

  return {
    kind: 'webgpu',
    renderer,
    hasGpuClock: clocked,
    draw: draw => draw(),
    drawTimed: async draw => {
      draw()
      if (!clocked) return []
      const value = await renderer.resolveTimestampsAsync('render')
      await nextFrame()
      return Number.isFinite(value) && value > 0 ? [value] : []
    },
    flushGpu: () => [],
    dispose: () => renderer.dispose(),
  }
}

const BACKENDS = { webgl: makeWebgl, webgpu: makeWebgpu }

async function measure(backendName, caseId, count, texture) {
  const canvas = freshCanvas()
  const harness = await BACKENDS[backendName](canvas)
  const isPost = caseId === 'postfx'

  const heapBefore = heapBytes()
  const builtAt = performance.now()
  const built = isPost ? buildCase('studio-scene', 420, texture) : buildCase(caseId, count, texture)
  const buildMs = performance.now() - builtAt

  let post = null
  if (isPost) {
    post =
      harness.kind === 'webgl'
        ? await buildWebglPost(harness.renderer, built.scene, built.camera, {
            width: WIDTH,
            height: HEIGHT,
          })
        : await buildWebgpuPost(harness.renderer, built.scene, built.camera)
  }

  const drawOnce = post
    ? () => post.draw()
    : () => harness.renderer.render(built.scene, built.camera)

  // Chauffe : compilation des shaders, montage des buffers, premiers uploads de texture. Rien de
  // tout cela n'est une frame, et le compter en ferait la p99 de chaque cas.
  for (let frame = 0; frame < WARMUP_FRAMES; frame++) {
    built.update(frame)
    drawOnce()
    await nextFrame()
  }

  const sync = []
  const render = []
  const wall = []
  let previous = performance.now()

  for (let frame = 0; frame < MEASURED_FRAMES; frame++) {
    const start = performance.now()
    built.update(WARMUP_FRAMES + frame)
    const synced = performance.now()
    drawOnce()
    const drawn = performance.now()
    sync.push(synced - start)
    render.push(drawn - synced)
    await nextFrame()
    const now = performance.now()
    wall.push(now - previous)
    previous = now
  }

  const gpu = []
  if (harness.hasGpuClock) {
    for (let frame = 0; frame < GPU_FRAMES; frame++) {
      built.update(WARMUP_FRAMES + MEASURED_FRAMES + frame)
      gpu.push(...(await harness.drawTimed(drawOnce)))
    }
    // Les requêtes WebGL encore en vol : le résultat n'est jamais prêt sur la frame qui l'ouvre.
    for (let frame = 0; frame < 4; frame++) {
      await nextFrame()
      gpu.push(...harness.flushGpu())
    }
  }

  // Les compteurs d'UNE frame, post-traitement compris. `autoReset` remettrait à zéro à chaque
  // passe interne du composer et ne publierait que la dernière.
  harness.renderer.info.autoReset = false
  harness.renderer.info.reset()
  drawOnce()
  const counters = rendererCounters(harness.renderer)

  const heapAfter = heapBytes()
  const walls = summarise(wall)

  const result = {
    backend: backendName,
    case: caseId,
    count,
    buildMs: Math.round(buildMs * 10) / 10,
    fpsMedian: walls ? Math.round((1000 / walls.median) * 10) / 10 : null,
    frameMs: walls,
    cpuSyncMs: summarise(sync),
    cpuRenderMs: summarise(render),
    gpuMs: summarise(gpu),
    heapMbBefore: heapBefore ? Math.round(heapBefore / 1e5) / 10 : null,
    heapMbAfter: heapAfter ? Math.round(heapAfter / 1e5) / 10 : null,
    ...counters,
    passes: post?.passes ?? null,
    rays: built.raysPerFrame ?? null,
  }

  post?.dispose()
  built.dispose()
  harness.dispose()
  return result
}

const POST_CASE = {
  id: 'postfx',
  label: 'post-traitement (étalonnage + vignettage)',
  counts: [420],
}

export function plan() {
  const jobs = []
  for (const one of [...CASES, POST_CASE]) {
    for (const count of one.counts) jobs.push({ caseId: one.id, label: one.label, count })
  }
  return jobs
}

export async function runAll(onProgress, filter = {}) {
  const texture = checker()
  const jobs = plan().filter(
    job =>
      (!filter.cases || filter.cases.includes(job.caseId)) &&
      (!filter.counts || filter.counts.includes(job.count)),
  )
  const backends = filter.backends ?? ['webgl', 'webgpu']
  const results = []
  const failures = []

  for (const backend of backends) {
    for (const job of jobs) {
      onProgress?.({
        backend,
        ...job,
        done: results.length + failures.length,
        total: jobs.length * backends.length,
      })
      try {
        results.push(await measure(backend, job.caseId, job.count, texture))
        // Publié après CHAQUE cas : un plantage de la fenêtre au cas suivant ne doit pas
        // emporter les vingt mesures déjà payées.
        globalThis.__partial = { results, failures }
      } catch (error) {
        failures.push({
          backend,
          case: job.caseId,
          count: job.count,
          error: String(error?.message ?? error),
        })
        globalThis.__partial = { results, failures }
      }
      // Une respiration entre deux cas : le ramasse-miettes du précédent ne doit pas tomber
      // dans la chauffe du suivant.
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }
  return { results, failures }
}
