import { DirectionalLight, Group, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { checker } from './floorScenes.js'
import { DEFAULT_PLAN, openWorld, spanFor } from './openWorld'

/**
 * Ce que la carte d'ombre du studio couvre VRAIMENT sur un grand monde, en images.
 *
 * 🛑 `fitShadowCamera` n'écrit que `left/right/top/bottom` — le rapport C4 le dit et le code le
 * confirme. `near` et `far` restent donc aux défauts de `DirectionalLightShadow`, soit **0,5 et
 * 500**, quelle que soit la taille de la scène. Sur un monde de 1200 de côté la boîte s'ouvre à
 * 1697 de LARGE et reste haute de 500 en PROFONDEUR : tout ce qui est plus loin que 500 de la
 * lumière le long de son axe ne projette rien.
 *
 * Ce banc ne corrige rien. Il rend deux images de la même vue — l'une telle que le studio la
 * dessine, l'autre avec la seule profondeur ouverte à ce que la scène occupe — et compte les
 * pixels qui diffèrent. Un chiffre ne dirait pas ce qu'une ombre manquante fait à une image.
 */

const WIDTH = 1000
const HEIGHT = 560
const QUERY = new URLSearchParams(location.search)

const nextFrame = (): Promise<number> => new Promise(resolve => requestAnimationFrame(resolve))

function pixelsOf(canvas: HTMLCanvasElement): ImageData {
  const flat = document.createElement('canvas')
  flat.width = canvas.width
  flat.height = canvas.height
  const paper = flat.getContext('2d')
  if (!paper) throw new Error('no 2d context')
  paper.drawImage(canvas, 0, 0)
  return paper.getImageData(0, 0, flat.width, flat.height)
}

/** La part de pixels qui diffèrent, et de combien en moyenne : le juge de C3, repris tel quel. */
function compare(one: ImageData, other: ImageData): { share: number; meanGap: number } {
  let differing = 0
  let gap = 0
  for (let at = 0; at < one.data.length; at += 4) {
    const delta =
      Math.abs((one.data[at] ?? 0) - (other.data[at] ?? 0)) +
      Math.abs((one.data[at + 1] ?? 0) - (other.data[at + 1] ?? 0)) +
      Math.abs((one.data[at + 2] ?? 0) - (other.data[at + 2] ?? 0))
    if (delta > 6) {
      differing += 1
      gap += delta / 3
    }
  }
  const pixels = one.data.length / 4
  return {
    share: Math.round((differing / pixels) * 10000) / 10000,
    meanGap: differing > 0 ? Math.round((gap / differing) * 10) / 10 : 0,
  }
}

export async function runWorldShot(): Promise<{ results: unknown[]; failures: unknown[] }> {
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

  const count = Number(QUERY.get('bodies') ?? 50_000)
  const span = spanFor(count)
  renderer.apply(openWorld({ ...DEFAULT_PLAN, count }))
  // 🛑 La vue doit regarder une zone à plus de 500 de la LUMIÈRE, sinon la troncature ne mord pas
  // et la capture rend 0 pixel différent en donnant l'impression qu'il n'y a rien à voir — mesuré.
  // Le soleil est en +x : on regarde donc vers −x, le sol visible allant de −0,4·span à −span.
  renderer.placeView({
    position: { x: -span * 0.4, y: 12, z: 0 },
    target: { x: -span * 0.4 - 1, y: 10, z: 0 },
  })

  let found: DirectionalLight | null = null
  renderer['viewport'].scene.traverse(object => {
    if (object instanceof DirectionalLight && object.castShadow) found = object
  })
  if (!found) throw new Error('no sun')
  const sun: DirectionalLight = found

  const gl = renderer['viewport'].gl
  const draw = (withShadow: boolean): void => {
    if (gl) gl.shadowMap.needsUpdate = withShadow
    renderer.drawFrom(null, 0)
  }

  /**
   * 🛑 Les pixels se lisent DANS LA FOULÉE du dessin, sans un seul `requestAnimationFrame` entre
   * les deux. Le contexte n'a pas `preserveDrawingBuffer`, donc le tampon est vidé à la frame
   * suivante et `toDataURL` rend une image VIDE — trois captures blanches lues comme « 0 pixel
   * différent », y compris entre ombres allumées et éteintes.
   */
  const shoot = (withShadow: boolean): { pixels: ImageData; png: string } => {
    draw(withShadow)
    return { pixels: pixelsOf(canvas), png: canvas.toDataURL('image/png') }
  }

  for (let frame = 0; frame < 6; frame += 1) {
    draw(true)
    await nextFrame()
  }
  const asShipped = {
    near: sun.shadow.camera.near,
    far: sun.shadow.camera.far,
    left: sun.shadow.camera.left,
    right: sun.shadow.camera.right,
  }
  const asShippedShot = shoot(true)
  const shipped = asShippedShot.pixels
  const shippedShot = asShippedShot.png

  // La seule chose ouverte est la PROFONDEUR, et jusqu'à ce que la scène occupe : les côtés, la
  // position de la lumière et tout le reste du document sont ceux du studio.
  const depth = Math.hypot(sun.position.x, sun.position.y, sun.position.z) + span * 2
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = depth
  sun.shadow.camera.updateProjectionMatrix()
  for (let frame = 0; frame < 6; frame += 1) {
    draw(true)
    await nextFrame()
  }
  const openedShoot = shoot(true)
  const opened = openedShoot.pixels
  const openedShot = openedShoot.png

  // 🛑 LE CONTRÔLE, sans lequel « 0 pixel différent » ne veut rien dire. Une carte d'ombre étalée
  // sur 3 400 unités pour 1 024 texels peut n'imprimer AUCUN pixel : la comparaison entre deux
  // profondeurs rendrait alors zéro sans qu'aucune ombre n'ait jamais existé. C'est le défaut de
  // méthode qui a bloqué C4 — une mesure qui lit la même chose des trois côtés ne distingue rien.
  renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: false })
  for (let frame = 0; frame < 6; frame += 1) {
    draw(false)
    await nextFrame()
  }
  const unlitShoot = shoot(false)
  const unlit = unlitShoot.pixels
  const unlitShot = unlitShoot.png

  renderer.dispose()
  host.remove()
  texture.dispose()
  return {
    results: [
      {
        count,
        span: Math.round(span),
        sunAt: { x: round(sun.position.x), y: round(sun.position.y), z: round(sun.position.z) },
        sunDistance: round(Math.hypot(sun.position.x, sun.position.y, sun.position.z)),
        asShipped,
        opened: { near: 0.5, far: round(depth) },
        // Ce que la profondeur ouverte change : la question posée.
        difference: compare(shipped, opened),
        // Ce que l'ombre change TOUT COURT : le contrôle. Nul, la mesure ci-dessus ne dit rien.
        shadowsVisible: compare(shipped, unlit),
        mapSize: sun.shadow.mapSize.width,
        unitsPerTexel: round((sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.width),
        // Jusqu'où la carte porte depuis la lumière, et jusqu'où le sol regardé s'étend : c'est
        // l'écart entre les deux qui dit si la vue exerce la troncature ou passe à côté.
        groundFrom: round(Math.hypot(sun.position.x + span * 0.4, sun.position.y, sun.position.z)),
        groundTo: round(Math.hypot(sun.position.x + span, sun.position.y, sun.position.z)),
        shots: { shipped: shippedShot, opened: openedShot, unlit: unlitShot },
      },
    ],
    failures: [],
  }
}

const round = (value: number): number => Math.round(value * 100) / 100
