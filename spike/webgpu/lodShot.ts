import { Group, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { sceneVaried, type ShapeLevel } from './engineScenes'
import { checker } from './floorScenes.js'
import { pacedLod } from './pacedLod'

/**
 * Ce que le LOD fait À L'IMAGE, et non aux chiffres : la même vue rendue avec et sans lui, les
 * deux PNG rendus côte à côte, et de combien de pixels ils diffèrent.
 *
 * Sans cela, « −93 % de triangles » ne dit pas si les sphères sont devenues des polyèdres.
 */

const WIDTH = 1200
const HEIGHT = 675
const QUERY = new URLSearchParams(location.search)

const nextFrame = (): Promise<number> => new Promise(resolve => requestAnimationFrame(resolve))

/** La part de pixels qui diffèrent de plus d'un cran, et l'écart moyen sur ceux-là. */
function compare(one: ImageData, other: ImageData): { share: number; meanGap: number; peakGap: number } {
  let differing = 0
  let sum = 0
  let peak = 0
  for (let at = 0; at < one.data.length; at += 4) {
    const gap =
      Math.abs((one.data[at] ?? 0) - (other.data[at] ?? 0)) +
      Math.abs((one.data[at + 1] ?? 0) - (other.data[at + 1] ?? 0)) +
      Math.abs((one.data[at + 2] ?? 0) - (other.data[at + 2] ?? 0))
    if (gap <= 3) continue
    differing += 1
    sum += gap
    if (gap > peak) peak = gap
  }
  return {
    share: differing / (one.data.length / 4),
    meanGap: differing > 0 ? sum / differing / 3 : 0,
    peakGap: peak / 3,
  }
}

function pixelsOf(canvas: HTMLCanvasElement): ImageData {
  const flat = document.createElement('canvas')
  flat.width = canvas.width
  flat.height = canvas.height
  const paper = flat.getContext('2d')
  if (!paper) throw new Error('no 2d context')
  paper.drawImage(canvas, 0, 0)
  return paper.getImageData(0, 0, flat.width, flat.height)
}

export async function runLodShot(): Promise<{ results: unknown[]; failures: unknown[] }> {
  const level = (QUERY.get('lod') ?? 'product') as ShapeLevel
  const count = Number(QUERY.get('bodies') ?? 50_000)
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
  renderer.prepareOffscreen({ alpha: false, pixelRatio: 1 })
  renderer.mount(host)
  renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: true })
  const canvas = host.querySelector('canvas')
  if (!canvas) throw new Error('the engine mounted no canvas')

  renderer.apply(sceneVaried(count, 7, level))
  // Dans le niveau, regardant devant : la vue où le LOD a le plus à faire, et la seule où il se
  // juge à l'oeil — des corps à un mètre et d'autres à cinquante dans la même image.
  renderer.placeView({ position: { x: -10, y: 0, z: 0 }, target: { x: 1, y: 0, z: 0 } })
  for (let frame = 0; frame < 30; frame += 1) {
    renderer['redraw']()
    await nextFrame()
  }
  const plain = pixelsOf(canvas)
  const plainShot = canvas.toDataURL('image/png')

  const lod = pacedLod(renderer['viewport'].scene, level)
  lod.mark(renderer['viewport'].perspective)
  lod.pump(renderer['viewport'].perspective, HEIGHT, 0)
  for (let frame = 0; frame < 30; frame += 1) {
    renderer['redraw']()
    await nextFrame()
  }
  const lodded = pixelsOf(canvas)
  const lodShot = canvas.toDataURL('image/png')

  const seen = compare(plain, lodded)
  lod.dispose()
  renderer.dispose()
  texture.dispose()

  return {
    results: [{ level, bodies: count, ...seen, plainShot, lodShot }],
    failures: [],
  }
}
