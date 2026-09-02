import {
  BoxGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Object3D,
  type PerspectiveCamera,
} from 'three'
import type { ShapeLevel } from './engineScenes'

/**
 * Les stratégies de LOD du chantier C3, MAQUETTÉES sur ce que le moteur a déjà construit.
 *
 * Aucune ligne de production : le banc prend la main sur les `InstancedMesh` que
 * `SceneRenderer.apply` a posés dans la scène, et leur échange leur géométrie avant chaque frame.
 * C'est exactement ce qu'un LOD ferait, ce qui rend le GPU comparable — et le CPU mesurable.
 *
 * 🛑 Ce que ce banc ne prétend pas être : les seuils sont arbitraires et écrits ici, pas
 * découverts. Ce qui se compare est le RAPPORT entre stratégies, jamais le réglage.
 */

/** Un niveau de moins qu'`InstancedMesh` n'en dessine à la fois : la géométrie, et rien d'autre. */
export type Ladder = { levels: BufferGeometry[]; radius: number }

export type LodStrategy = 'none' | 'regionDistance' | 'regionScreen' | 'instanceScreen' | 'instanceSplit'

export const LOD_STRATEGIES: readonly LodStrategy[] = [
  'none',
  'regionDistance',
  'regionScreen',
  'instanceScreen',
  'instanceSplit',
]

/**
 * Les résolutions descendantes de chaque forme de `sceneVaried`, la première étant celle que la
 * scène porte. Un cube n'a qu'un niveau : douze triangles ne se réduisent pas.
 */
const SPHERE_STEPS: Record<ShapeLevel, [number, number][]> = {
  product: [
    [32, 16],
    [16, 12],
    [10, 8],
    [6, 4],
  ],
  full: [
    [16, 12],
    [12, 8],
    [8, 6],
    [6, 4],
  ],
  half: [
    [12, 8],
    [10, 6],
    [8, 5],
    [6, 4],
  ],
  quarter: [
    [8, 6],
    [7, 5],
    [6, 4],
    [5, 3],
  ],
  tenth: [
    [6, 4],
    [5, 4],
    [5, 3],
    [4, 3],
  ],
}

const CYLINDER_STEPS: Record<ShapeLevel, number[]> = {
  product: [32, 16, 10, 6],
  full: [16, 12, 8, 6],
  half: [12, 10, 8, 6],
  quarter: [8, 7, 6, 5],
  tenth: [6, 5, 5, 4],
}

/** Combien de triangles une forme indexée dessine — ce qui identifie sa famille sans la nommer. */
const trianglesOf = (geometry: BufferGeometry): number =>
  (geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3

export function laddersFor(level: ShapeLevel): Map<number, Ladder> {
  const spheres = (SPHERE_STEPS[level] ?? SPHERE_STEPS.full).map(
    ([width, height]) => new SphereGeometry(0.6, width, height),
  )
  const cylinders = (CYLINDER_STEPS[level] ?? CYLINDER_STEPS.full).map(
    segments => new CylinderGeometry(0.5, 0.5, 1.2, segments),
  )
  const box = new BoxGeometry(1, 1, 1)

  const ladders = new Map<number, Ladder>()
  // Indexée par le compte de triangles du PREMIER niveau : c'est ce que la scène porte, et
  // c'est ce que l'`InstancedMesh` construit par le moteur dessine.
  const first = <T extends BufferGeometry>(levels: T[]): T => levels[0] ?? levels[levels.length - 1]!
  ladders.set(trianglesOf(box), { levels: [box], radius: 0.87 })
  ladders.set(trianglesOf(first(spheres)), { levels: spheres, radius: 0.6 })
  ladders.set(trianglesOf(first(cylinders)), { levels: cylinders, radius: 0.72 })
  return ladders
}

/** Ce qu'un tour de LOD a coûté au CPU, et ce qu'il a changé. */
export type LodRig = {
  /** Choisit un niveau pour ce que la caméra voit, et l'écrit. Rend les millisecondes passées. */
  apply: (camera: PerspectiveCamera, height: number) => number
  /** Le niveau de chaque lot au dernier tour, pour dire ce qui a été choisi plutôt que supposé. */
  chosen: () => number[]
  dispose: () => void
}

const AT = new Vector3()
const EYE = new Vector3()
const HELD = new Matrix4()

/**
 * Le rayon d'une sphère de rayon `radius` à cette distance, en PIXELS de hauteur d'image.
 *
 * `height / (2 · tan(fov/2))` est la moitié de la hauteur visible à une unité : la taille écran
 * est ce qui décide, pas la distance, parce qu'un gros objet loin reste gros.
 */
export const screenRadius = (radius: number, distance: number, camera: PerspectiveCamera, height: number) =>
  distance <= 0 ? Infinity : (radius * height) / (2 * distance * Math.tan((camera.fov * Math.PI) / 360))

/** Les seuils en PIXELS de rayon projeté, du plus fin au plus grossier. */
export const SCREEN_STEPS = [90, 34, 12]

/** Les mêmes en unités de scène, pour la stratégie qui ne regarde que la distance. */
const DISTANCE_STEPS = [28, 55, 90]

const levelForScreen = (pixels: number): number => {
  for (const [at, step] of SCREEN_STEPS.entries()) if (pixels >= step) return at
  return SCREEN_STEPS.length
}

const levelForDistance = (distance: number): number => {
  for (const [at, step] of DISTANCE_STEPS.entries()) if (distance <= step) return at
  return DISTANCE_STEPS.length
}

/** Les lots que le moteur a posés, avec l'échelle de résolutions de la forme qu'ils dessinent. */
function lotsOf(scene: Object3D, ladders: Map<number, Ladder>): { lot: InstancedMesh; ladder: Ladder }[] {
  const found: { lot: InstancedMesh; ladder: Ladder }[] = []
  scene.traverse(object => {
    if (!(object instanceof InstancedMesh)) return
    const ladder = ladders.get(trianglesOf(object.geometry))
    if (ladder) found.push({ lot: object, ladder })
  })
  return found
}

/**
 * Une étagère par niveau et par lot, à la capacité du lot, posée à côté de lui — et le lot
 * d'origine effacé, puisque ce sont elles qui dessinent pour lui.
 *
 * Rien n'est rendu pour un niveau vide : `visible` à faux, et non un compte à zéro, qui émet un
 * appel de dessin de zéro instance.
 */
function splitLots(
  scene: Object3D,
  lots: { lot: InstancedMesh; ladder: Ladder }[],
): InstancedMesh[][] {
  return lots.map(({ lot, ladder }) => {
    const shelves = ladder.levels.map(geometry => {
      const shelf = new InstancedMesh(geometry, lot.material, lot.count)
      shelf.castShadow = lot.castShadow
      shelf.receiveShadow = lot.receiveShadow
      shelf.visible = false
      scene.add(shelf)
      return shelf
    })
    lot.visible = false
    return shelves
  })
}

export function rigLod(scene: Object3D, strategy: LodStrategy, level: ShapeLevel): LodRig {
  const ladders = laddersFor(level)
  const lots = lotsOf(scene, ladders)
  const chosen = lots.map(() => 0)
  const counts = lots.map(({ lot }) => lot.count)
  /** Ce que chaque lot dessinait avant qu'on y touche, pour rendre la scène telle qu'on l'a prise. */
  const worn = lots.map(({ lot }) => lot.geometry)

  /**
   * La stratégie par INSTANCE, maquettée sans repartitionner : chaque corps est projeté et son
   * niveau calculé, puis on prend le plus fin du lot. Ce que ça mesure est le CPU de « 50 000
   * corps testés par frame », qui est la question — pas ce qu'un vrai partitionnement dessinerait.
   */
  const perInstance = (camera: PerspectiveCamera, height: number): void => {
    camera.getWorldPosition(EYE)
    for (const [at, { lot, ladder }] of lots.entries()) {
      let finest = SCREEN_STEPS.length
      for (let slot = 0; slot < lot.count; slot += 1) {
        lot.getMatrixAt(slot, HELD)
        AT.setFromMatrixPosition(HELD)
        const found = levelForScreen(screenRadius(ladder.radius, AT.distanceTo(EYE), camera, height))
        if (found < finest) finest = found
      }
      chosen[at] = finest
      lot.geometry = ladder.levels[finest] ?? ladder.levels[ladder.levels.length - 1]!
    }
  }

  const perLot = (camera: PerspectiveCamera, height: number): void => {
    camera.getWorldPosition(EYE)
    for (const [at, { lot, ladder }] of lots.entries()) {
      const bounds = lot.boundingSphere
      if (!bounds) continue
      const distance = AT.copy(bounds.center).applyMatrix4(lot.matrixWorld).distanceTo(EYE)
      const found =
        strategy === 'regionScreen'
          ? levelForScreen(screenRadius(bounds.radius, distance, camera, height))
          : levelForDistance(distance)
      chosen[at] = found
      lot.geometry = ladder.levels[found] ?? ladder.levels[ladder.levels.length - 1]!
    }
  }

  /**
   * Le LOD par corps, VRAIMENT réparti : un lot par niveau, dont on remplit les matrices et
   * règle le compte à chaque tour. Le pire cas assumé — aucune hystérésis, tout est recalculé et
   * réécrit à chaque frame — parce que c'est le plafond de coût qu'il faut connaître avant de
   * décider si une hystérésis vaut d'être écrite.
   */
  const split = strategy === 'instanceSplit' ? splitLots(scene, lots) : []
  const perSplit = (camera: PerspectiveCamera, height: number): void => {
    camera.getWorldPosition(EYE)
    for (const [at, { lot, ladder }] of lots.entries()) {
      const shelves = split[at]
      if (!shelves) continue
      for (const shelf of shelves) shelf.count = 0

      for (let slot = 0; slot < lot.count; slot += 1) {
        lot.getMatrixAt(slot, HELD)
        AT.setFromMatrixPosition(HELD)
        const found = levelForScreen(
          screenRadius(ladder.radius, AT.distanceTo(EYE), camera, height),
        )
        const shelf = shelves[Math.min(found, shelves.length - 1)]
        if (!shelf) continue
        shelf.setMatrixAt(shelf.count, HELD)
        shelf.count += 1
      }

      let finest = shelves.length
      for (const [level, shelf] of shelves.entries()) {
        shelf.visible = shelf.count > 0
        shelf.instanceMatrix.needsUpdate = true
        // Ses propres bornes, à chaque tour : ce que le lot tient change à chaque frame, et un
        // rayon périmé fait dessiner ce que le frustum écartait — mesuré, le LOD AJOUTAIT alors
        // des triangles en vue intérieure. C'est un coût du mécanisme, pas un détail.
        if (shelf.count > 0) shelf.computeBoundingSphere()
        if (shelf.count > 0 && level < finest) finest = level
      }
      chosen[at] = finest
    }
  }

  return {
    apply: (camera, height) => {
      if (strategy === 'none') return 0
      const started = performance.now()
      if (strategy === 'instanceSplit') perSplit(camera, height)
      else if (strategy === 'instanceScreen') perInstance(camera, height)
      else perLot(camera, height)
      return performance.now() - started
    },

    chosen: () => [...chosen],

    dispose: () => {
      for (const [at, { lot }] of lots.entries()) {
        lot.geometry = worn[at] ?? lot.geometry
        lot.visible = true
        lot.count = counts[at] ?? lot.count
      }
      for (const shelves of split) for (const shelf of shelves) {
        shelf.removeFromParent()
        shelf.dispose()
      }
      for (const { levels } of ladders.values()) for (const geometry of levels) geometry.dispose()
    },
  }
}
