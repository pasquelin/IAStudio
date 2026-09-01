/**
 * CHANTIER B — à partir de quelle taille de groupe l'instanciation paie.
 *
 * `WORTH_INSTANCING = 64` n'a jamais été mesuré : `instancing.ts` cite 744 fps en un appel, sans
 * dire ce que coûte un groupe de 16. Ce banc rend la courbe, sans toucher au moteur.
 *
 * 🛑 Le temps CPU se prend sur un BLOC de frames, jamais frame par frame : `performance.now()`
 * est clampé à 100 µs dans une page non isolée, et ce qu'on cherche ici passe sous ce tick. Un
 * bloc de quinze frames ramène la résolution à ~7 µs.
 */
import { createGlTimer } from './glTimer.js'
import { TOTAL, dispose, instanced, separate } from './groupScenes.js'

const WIDTH = 1600
const HEIGHT = 900
const WARMUP = 25
const BLOCKS = 10
const FRAMES = 15
export const GROUP_SIZES = [4, 8, 16, 32, 64, 128, 256, 1000]

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

const median = values => {
  const sorted = [...values].sort((one, other) => one - other)
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]
}
const round = value => Math.round(value * 1000) / 1000

function freshRenderer(WebGLRenderer, PCFShadowMap) {
  const stage = document.querySelector('#stage')
  stage.replaceChildren()
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  canvas.style.width = `${WIDTH / 2}px`
  canvas.style.height = `${HEIGHT / 2}px`
  stage.append(canvas)

  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(1)
  renderer.setSize(WIDTH, HEIGHT, false)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  return renderer
}

async function measure(renderer, built) {
  const timer = createGlTimer(renderer.getContext())

  for (let frame = 0; frame < WARMUP; frame++) {
    renderer.render(built.scene, built.camera)
    await nextFrame()
  }
  timer?.collect()

  const cpu = []
  const wall = []
  const gpu = []

  for (let block = 0; block < BLOCKS; block++) {
    const opened = performance.now()
    for (let frame = 0; frame < FRAMES; frame++) {
      timer?.begin()
      renderer.render(built.scene, built.camera)
      timer?.end()
      await nextFrame()
      gpu.push(...(timer?.collect() ?? []))
    }
    // Le mur ET le CPU sur le même bloc : entre deux `render` il n'y a que le rAF, donc la part
    // CPU se lit sur le bloc entier plutôt que sur chaque appel, sous le tick de l'horloge.
    wall.push((performance.now() - opened) / FRAMES)

    const started = performance.now()
    for (let frame = 0; frame < FRAMES; frame++) renderer.render(built.scene, built.camera)
    cpu.push((performance.now() - started) / FRAMES)
    await nextFrame()
  }
  for (let frame = 0; frame < 4; frame++) {
    await nextFrame()
    gpu.push(...(timer?.collect() ?? []))
  }

  renderer.info.autoReset = false
  renderer.info.reset()
  renderer.render(built.scene, built.camera)
  const drawCalls = renderer.info.render.calls
  const triangles = renderer.info.render.triangles
  timer?.dispose()

  return {
    cpuMs: round(median(cpu)),
    frameMs: round(median(wall)),
    fps: round(1000 / median(wall)),
    gpuMs: gpu.length > 0 ? round(median(gpu)) : null,
    gpuSamples: gpu.length,
    drawCalls,
    triangles,
  }
}

export async function runGroups(onProgress) {
  const { WebGLRenderer, PCFShadowMap } = await import('three')
  const results = []
  const failures = []
  const modes = [
    ['separate', separate],
    ['instanced', instanced],
  ]

  for (const groupSize of GROUP_SIZES) {
    for (const [mode, build] of modes) {
      onProgress?.({ groupSize, mode, done: results.length, total: GROUP_SIZES.length * modes.length })
      const renderer = freshRenderer(WebGLRenderer, PCFShadowMap)
      let built = null
      try {
        const builtAt = performance.now()
        built = build(groupSize)
        const buildMs = round(performance.now() - builtAt)
        results.push({ groupSize, mode, total: TOTAL, groups: built.groups, buildMs, ...(await measure(renderer, built)) })
      } catch (error) {
        failures.push({ groupSize, mode, error: String(error?.message ?? error) })
      } finally {
        if (built) dispose(built)
        renderer.dispose()
      }
      globalThis.__partial = { results, failures }
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  return { results, failures }
}
