/**
 * Les deux mesures « 64 contre 16 » demandées : ce que coûte une scène dont un corps sur six
 * bouge à chaque frame, et ce qu'elle tient en mémoire.
 *
 * 🛑 Le temps CPU se prend sur un bloc de frames : `performance.now()` est clampé à 100 µs dans
 * une page non isolée, et une part de ce qu'on cherche passe sous ce tick.
 */
import { createGlTimer } from './glTimer.js'
import { GROUPS, MOVING_SHARE, build } from './floorScenes.js'

const WIDTH = 1600
const HEIGHT = 900
const WARMUP = 30
const BLOCKS = 10
const FRAMES = 15
const EDITS = 100

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))
const median = values => {
  const sorted = [...values].sort((one, other) => one - other)
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]
}
const round = value => Math.round(value * 1000) / 1000
const heapMb = () => (performance.memory ? round(performance.memory.usedJSHeapSize / 1e6) : null)

function canvasOf() {
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

/** Cent gestes d'édition : ce qu'une session d'atelier fait à la scène entre deux mesures. */
function edit(built, at) {
  built.update(1000 + at)
  const mover = built.movers > 0 ? at % built.movers : 0
  return mover
}

export async function runFloor(onProgress) {
  const { WebGLRenderer, PCFShadowMap } = await import('three')
  const results = []

  for (const floor of [64, 16]) {
    onProgress?.({ floor, phase: 'construction' })
    const canvas = canvasOf()
    const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(1)
    renderer.setSize(WIDTH, HEIGHT, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap

    const heapBefore = heapMb()
    const built = build(floor)
    const timer = createGlTimer(renderer.getContext())

    for (let frame = 0; frame < WARMUP; frame++) {
      built.update(frame)
      renderer.render(built.scene, built.camera)
      await nextFrame()
    }
    timer?.collect()
    const heapLoaded = heapMb()
    onProgress?.({ floor, phase: 'mesure' })

    const cpu = []
    const upload = []
    const wall = []
    const gpu = []

    for (let block = 0; block < BLOCKS; block++) {
      const opened = performance.now()
      for (let frame = 0; frame < FRAMES; frame++) {
        built.update(WARMUP + block * FRAMES + frame)
        timer?.begin()
        renderer.render(built.scene, built.camera)
        timer?.end()
        await nextFrame()
        gpu.push(...(timer?.collect() ?? []))
      }
      wall.push((performance.now() - opened) / FRAMES)

      // Le re-upload seul : `update` réécrit les matrices et lève `needsUpdate`, le rendu les
      // envoie. Les deux se mesurent sur un bloc, sans rAF entre eux.
      const movedAt = performance.now()
      for (let frame = 0; frame < FRAMES; frame++) built.update(2000 + frame)
      upload.push((performance.now() - movedAt) / FRAMES)

      const started = performance.now()
      for (let frame = 0; frame < FRAMES; frame++) renderer.render(built.scene, built.camera)
      cpu.push((performance.now() - started) / FRAMES)
      await nextFrame()
    }
    for (let frame = 0; frame < 4; frame++) {
      await nextFrame()
      gpu.push(...(timer?.collect() ?? []))
    }

    onProgress?.({ floor, phase: 'édition' })
    for (let at = 0; at < EDITS; at++) {
      edit(built, at)
      renderer.render(built.scene, built.camera)
      if (at % 10 === 0) await nextFrame()
    }
    await nextFrame()
    const heapEdited = heapMb()

    renderer.info.autoReset = false
    renderer.info.reset()
    renderer.render(built.scene, built.camera)

    results.push({
      floor,
      bodies: built.total,
      moving: built.movers,
      movingShare: round((built.movers / built.total) * 100),
      instancedGroups: GROUPS.filter(size => size >= floor).length,
      instancedBodies: GROUPS.filter(size => size >= floor).reduce((sum, size) => sum + size, 0),
      cpuRenderMs: round(median(cpu)),
      uploadMs: round(median(upload)),
      frameMs: round(median(wall)),
      fps: round(1000 / median(wall)),
      gpuMs: gpu.length > 0 ? round(median(gpu)) : null,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      heapBefore,
      heapLoaded,
      heapEdited,
    })

    timer?.dispose()
    built.scene.traverse(object => {
      if (object.geometry) object.geometry.dispose()
      const material = object.material
      if (Array.isArray(material)) material.forEach(one => one.dispose())
      else if (material) material.dispose()
    })
    renderer.dispose()
    globalThis.__partial = { results, failures: [] }
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return { results, failures: [], movingShare: round(100 / MOVING_SHARE) }
}
