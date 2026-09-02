import { Group, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { checker } from './floorScenes.js'
import { comparePixels, nextFrame, pixelsOf, sunOf } from './benchShared'
import { DEFAULT_PLAN, openWorld, spanFor } from './openWorld'

/**
 * Ce que la carte d'ombre du studio couvre vraiment sur un grand monde, en images.
 *
 * 🛑 `fitShadowCamera` n'écrit que les côtés, donc `near`/`far` restent aux défauts de
 * `DirectionalLightShadow` — **0,5 et 500** — quelle que soit la scène : à 1 200 de demi-côté la
 * boîte s'ouvre à 3 410 de LARGE et reste haute de 500 en PROFONDEUR. Rien n'est corrigé ici.
 */

const WIDTH = 1000
const HEIGHT = 560
/** En dessous, c'est du bruit de PCF plutôt qu'une ombre qui change. */
const PIXEL_THRESHOLD = 6
const QUERY = new URLSearchParams(location.search)

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

  const sun = sunOf(renderer['viewport'].scene)
  if (!sun) throw new Error('no sun')

  const gl = renderer['viewport'].gl
  const draw = (withShadow: boolean): void => {
    if (gl) gl.shadowMap.needsUpdate = withShadow
    renderer.drawFrom(null, 0)
  }

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
  const { pixels: shipped, png: shippedShot } = shoot(true)

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
  const { pixels: opened, png: openedShot } = shoot(true)

  // 🛑 LE CONTRÔLE, sans lequel « 0 pixel différent » ne veut rien dire : une carte étalée sur
  // 3 400 unités pour 2 048 texels peut n'imprimer aucun pixel, et la comparaison des profondeurs
  // rendrait zéro sans qu'aucune ombre n'ait jamais existé.
  renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: false })
  for (let frame = 0; frame < 6; frame += 1) {
    draw(false)
    await nextFrame()
  }
  const { pixels: unlit, png: unlitShot } = shoot(false)

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
        difference: comparePixels(shipped, opened, PIXEL_THRESHOLD),
        // Le CONTRÔLE : si l'ombre ne change aucun pixel, la mesure ci-dessus ne dit rien.
        shadowsVisible: comparePixels(shipped, unlit, PIXEL_THRESHOLD),
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
