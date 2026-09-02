import { Box3, DirectionalLight, Group, Vector3, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { EMPTY_SCENE, type SceneNode } from '@/engines/scene/sceneState'
import { directionalLight, meshNode } from '@/engines/scene/scene-fixtures'
import { checker } from './floorScenes.js'
import { boxSpan, shadowBoxFor, wearShadowBox, type ShadowFit } from './shadowVolume'

/**
 * Le test qui décide de C4 : une ombre qui doit rester, et une qui ne sert à rien.
 *
 * 🛑 La correction passe avant le chiffre. Un volume ajusté sur la seule VUE perd l'ombre d'un
 * corps hors champ, et c'est invisible dans un tableau de triangles — seule une image le dit.
 */

const WIDTH = 1000
const HEIGHT = 560

const nextFrame = (): Promise<number> => new Promise(resolve => requestAnimationFrame(resolve))

/**
 * Un sol qui reçoit, un mur DANS le champ, un mur HORS champ dont l'ombre tombe dans l'image, et
 * un mur si loin derrière que sa propre ombre ne peut pas y arriver.
 *
 * Le soleil vient de +x : ce qui est à gauche de l'image projette vers la droite, donc le caster
 * hors champ est posé à gauche, hors du cadre.
 */
function stage(): SceneNode[] {
  const ground = meshNode('ground')
  const near = meshNode('inView')
  const off = meshNode('offScreen')
  const useless = meshNode('useless')
  const sun = directionalLight('sun')
  return [
    { ...sun, castShadow: true, transform: { ...sun.transform, position: { x: 40, y: 30, z: 0 } } },
    {
      ...ground,
      geometry: { kind: 'box', width: 120, height: 0.4, depth: 60 },
      transform: { ...ground.transform, position: { x: 0, y: -2, z: 0 } },
    },
    {
      ...near,
      geometry: { kind: 'box', width: 1.4, height: 6, depth: 6 },
      material: { ...near.material, color: '#ff5544' },
      transform: { ...near.transform, position: { x: 4, y: 1, z: 0 } },
    },
    // Hors cadre à droite, entre le soleil et l'image : son ombre tombe DANS l'image.
    {
      ...off,
      geometry: { kind: 'box', width: 1.4, height: 8, depth: 8 },
      material: { ...off.material, color: '#44ff66' },
      transform: { ...off.transform, position: { x: 26, y: 2, z: 0 } },
    },
    // Très loin derrière la caméra, du côté opposé au soleil : rien de son ombre n'atteint l'image.
    {
      ...useless,
      geometry: { kind: 'box', width: 4, height: 8, depth: 8 },
      material: { ...useless.material, color: '#4466ff' },
      transform: { ...useless.transform, position: { x: -55, y: 2, z: 0 } },
    },
  ]
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

/** La part de pixels SOMBRES du sol : c'est ce qu'une ombre perdue fait bouger. */
function shaded(pixels: ImageData): number {
  let dark = 0
  let ground = 0
  // La moitié basse de l'image seule : c'est là que le sol est, et une ombre s'y lit.
  for (let row = Math.floor(pixels.height * 0.55); row < pixels.height; row += 1) {
    for (let column = 0; column < pixels.width; column += 1) {
      const at = (row * pixels.width + column) * 4
      const light = ((pixels.data[at] ?? 0) + (pixels.data[at + 1] ?? 0) + (pixels.data[at + 2] ?? 0)) / 3
      if (light < 8) continue
      ground += 1
      if (light < 105) dark += 1
    }
  }
  return ground > 0 ? dark / ground : 0
}

export async function runShadowShot(): Promise<{ results: unknown[]; failures: unknown[] }> {
  const stageHost = document.querySelector('#stage')
  if (!stageHost) throw new Error('no #stage')
  const host = document.createElement('div')
  host.style.width = `${WIDTH}px`
  host.style.height = `${HEIGHT}px`
  stageHost.append(host)

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

  renderer.apply({ ...EMPTY_SCENE, nodes: stage() })
  // Le cadre tient le mur de gauche et le sol, et LAISSE DEHORS celui de droite.
  renderer.placeView({ position: { x: -12, y: 6, z: 26 }, target: { x: 2, y: 0, z: 0 } })

  let sun: DirectionalLight | null = null
  renderer['viewport'].scene.traverse(object => {
    if (object instanceof DirectionalLight && object.castShadow) sun = object
  })
  if (!sun) throw new Error('no sun')
  const light: DirectionalLight = sun

  const world = new Box3(new Vector3(-60, -3, -30), new Vector3(60, 12, 30))
  const camera = renderer['viewport'].perspective
  const shots: Record<string, string> = {}
  const marks: Record<string, number> = {}
  const spans: Record<string, number> = {}

  for (const fit of ['scene', 'view', 'viewCasters'] as ShadowFit[]) {
    for (let frame = 0; frame < 12; frame += 1) {
      const box = shadowBoxFor(fit, light.shadow.camera, camera, world, 0, 120)
      wearShadowBox(light.shadow.camera, box)
      spans[fit] = Math.round(boxSpan(box) * 100) / 100
      renderer['redraw']()
      await nextFrame()
    }
    marks[fit] = Math.round(shaded(pixelsOf(canvas)) * 10000) / 10000
    shots[fit] = canvas.toDataURL('image/png')
  }

  renderer.dispose()
  host.remove()
  texture.dispose()
  return {
    results: [{ shadedShare: marks, spans, shots }],
    failures: [],
  }
}
