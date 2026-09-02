import { directionalLight, meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type MeshNode, type SceneNode, type SceneState } from '@/engines/scene/sceneState'
import type { GeometryDescriptor } from '@shared/domain/geometry'
import { createRandom } from '@game/runtime/random'
import type { ShapeLevel } from './engineScenes'

/**
 * Le monde du chantier C5 : plat, très grand, et vu depuis DEDANS.
 *
 * Quatre besoins que `sceneField` de C4 ne couvrait pas : densité CONSTANTE (sinon 500 000 mesure
 * une densité et non une taille de monde) · un SOL, sans quoi aucune ombre ne se lit · deux
 * CLASSES de corps, un repère restant visible là où un accessoire ne l'est plus · deux
 * RÉPARTITIONS, l'uniforme étant le pire cas d'une grille.
 */

/** Ce que le monde tient, hors sol et hors soleil. */
export type WorldSpread = 'uniform' | 'clustered'

export const WORLD_SPREADS: readonly WorldSpread[] = ['uniform', 'clustered']

/**
 * Le demi-côté qui garde la densité de `sceneField` — 50 000 corps sur 600 — quel que soit le
 * compte. La surface suit le nombre, donc ce qui entoure la caméra ne change jamais.
 */
export const spanFor = (count: number): number => 600 * Math.sqrt(count / 50_000)

/** Le côté d'une dalle de sol. Fixe : c'est la densité de dalles qui doit rester constante. */
const TILE = 100

/** La part de corps qui sont des repères plutôt que des accessoires. */
const LANDMARK_SHARE = 0.03

/**
 * 🛑 Distance FIXE, et c'est un choix mesuré. `DirectionalLightShadow` naît avec `far = 500` et le
 * studio ne l'écrit jamais, donc un soleil qui suit la taille du monde emmène sa tranche hors de
 * la scène : les triangles d'ombre TOMBAIENT quand le monde grandissait — 6,0 M à 50 000, 8,2 M à
 * 100 000, 1,08 M à 200 000. La troncature à 500 reste, elle est du produit et non du décor.
 */
const SUN_DISTANCE = 200

/** Un amas par carré de ce côté, et la même densité d'amas à toutes les tailles. */
const CLUSTER_EVERY = 200

/** Le rayon dans lequel un amas serre ses corps. */
const CLUSTER_RADIUS = 60

/** La part des accessoires qui tombe dans un amas ; le reste est épars entre eux. */
const CLUSTERED_SHARE = 0.7

const PROP_PAINTS = ['#8d7f6a', '#6f8d6a', '#6a7f8d', '#8d6a72', '#7a7a80', '#95886b', '#5f7a6b', '#7f6f8d']
const LANDMARK_PAINTS = ['#b9b2a4', '#9aa3ad']
const GROUND_PAINT = '#4a4f45'

/**
 * 🛑 Une seule description par forme, la taille venant du SCALE : deux boîtes de dimensions
 * différentes sont deux clés de regroupement, donc mille repères tirés au hasard seraient mille
 * appels de dessin et aucune instance.
 */
const SPHERES: Record<ShapeLevel, { widthSegments: number; heightSegments: number }> = {
  product: { widthSegments: 32, heightSegments: 16 },
  full: { widthSegments: 16, heightSegments: 12 },
  half: { widthSegments: 12, heightSegments: 8 },
  quarter: { widthSegments: 8, heightSegments: 6 },
  tenth: { widthSegments: 6, heightSegments: 4 },
}

const CYLINDERS: Record<ShapeLevel, number> = { product: 32, full: 16, half: 12, quarter: 8, tenth: 6 }

const propShapes = (level: ShapeLevel): GeometryDescriptor[] => [
  { kind: 'box', width: 1, height: 1, depth: 1 },
  { kind: 'sphere', radius: 0.5, ...(SPHERES[level] ?? SPHERES.full) },
  { kind: 'cylinder', radiusTop: 0.5, radiusBottom: 0.5, height: 1, segments: CYLINDERS[level] ?? CYLINDERS.full },
]

const UNIT_BOX: GeometryDescriptor = { kind: 'box', width: 1, height: 1, depth: 1 }

export type Point = { x: number; y: number; z: number }

/** Où le soleil se tient. Seule sa DIRECTION éclaire, mais elle décide de quel côté poser un
 * caster hors champ pour que son ombre entre dans l'image — le cas B de C4. */
export const sunAt = (azimuth: number, elevation: number, reach: number): Point => ({
  x: Math.cos(azimuth) * Math.cos(elevation) * reach,
  y: Math.sin(elevation) * reach,
  z: Math.sin(azimuth) * Math.cos(elevation) * reach,
})

export type WorldPlan = {
  count: number
  spread: WorldSpread
  level: ShapeLevel
  seed: number
  /** L'azimut du soleil, en radians. Le défaut le met en +x, comme le décor d'ombre de C4. */
  azimuth: number
  /** Son élévation, en radians. Bas fait de longues ombres, ce que le cas B demande. */
  elevation: number
}

export const DEFAULT_PLAN: Omit<WorldPlan, 'count'> = {
  spread: 'uniform',
  level: 'product',
  seed: 11,
  azimuth: 0,
  elevation: Math.PI / 6,
}

/** Deux tirages normaux d'un générateur uniforme, pour serrer un amas autour de son centre. */
function gaussianPair(random: () => number): [number, number] {
  const radius = Math.sqrt(-2 * Math.log(1 - random()))
  const angle = 2 * Math.PI * random()
  return [radius * Math.cos(angle), radius * Math.sin(angle)]
}

/** Combien d'amas un monde porte : un par carré de `CLUSTER_EVERY`, à toutes les tailles. */
const clusterCount = (span: number): number =>
  Math.max(1, Math.round((2 * span * 2 * span) / (CLUSTER_EVERY * CLUSTER_EVERY)))

function clusterCentres(span: number, random: () => number): Point[] {
  return Array.from({ length: clusterCount(span) }, () => ({
    x: (random() - 0.5) * 2 * span,
    y: 0,
    z: (random() - 0.5) * 2 * span,
  }))
}

const inside = (value: number, span: number): number => Math.max(-span, Math.min(span, value))

/** Le sol, en dalles : un plan unique resterait dessiné où que la caméra regarde. */
function groundTiles(span: number): MeshNode[] {
  const perAxis = Math.ceil((2 * span) / TILE)
  const nodes: MeshNode[] = []
  for (let row = 0; row < perAxis; row += 1) {
    for (let column = 0; column < perAxis; column += 1) {
      const base = meshNode(`tile_${row}_${column}`)
      nodes.push({
        ...base,
        geometry: UNIT_BOX,
        material: { ...base.material, color: GROUND_PAINT, roughness: 0.9, metalness: 0 },
        transform: {
          position: {
            x: -span + (column + 0.5) * TILE,
            y: -0.25,
            z: -span + (row + 0.5) * TILE,
          },
          rotation: { x: 0, y: 0, z: 0 },
          // Le dessus des dalles est à y = 0 : tout ce qui est posé compte depuis là.
          scale: { x: TILE, y: 0.5, z: TILE },
        },
      })
    }
  }
  return nodes
}

/**
 * Le monde entier, en ÉTAT du studio : c'est `SceneRenderer.apply` qui bâtit les meshes. `count`
 * ne compte QUE les corps posés — le sol s'y ajoute et suit la surface, et les relevés écrivent
 * les deux.
 */
export function openWorld(plan: WorldPlan): SceneState {
  const span = spanFor(plan.count)
  const { next: random } = createRandom(plan.seed)
  const shapes = propShapes(plan.level)
  const centres = plan.spread === 'clustered' ? clusterCentres(span, random) : []
  const nodes: MeshNode[] = [...groundTiles(span)]

  for (let at = 0; at < plan.count; at += 1) {
    const landmark = random() < LANDMARK_SHARE
    let x = (random() - 0.5) * 2 * span
    let z = (random() - 0.5) * 2 * span
    // Un repère reste épars où qu'on soit : un village serré de tours ne mesure rien de plus.
    if (!landmark && centres.length > 0 && random() < CLUSTERED_SHARE) {
      const centre = centres[Math.floor(random() * centres.length)] ?? centres[0]!
      const [offsetX, offsetZ] = gaussianPair(random)
      x = inside(centre.x + offsetX * CLUSTER_RADIUS, span)
      z = inside(centre.z + offsetZ * CLUSTER_RADIUS, span)
    }

    const base = meshNode(landmark ? `mark${at}` : `prop${at}`)
    if (landmark) {
      // Une tour : large de 4 à 10, haute de 16 à 50. Même boîte unité que tout le reste, donc un
      // seul lot — c'est le SCALE qui la fait haute.
      const wide = 4 + random() * 6
      const tall = 16 + random() * 34
      nodes.push({
        ...base,
        geometry: UNIT_BOX,
        material: {
          ...base.material,
          color: LANDMARK_PAINTS[at % LANDMARK_PAINTS.length] ?? LANDMARK_PAINTS[0]!,
          roughness: 0.8,
          metalness: 0,
        },
        transform: {
          position: { x, y: tall / 2, z },
          rotation: { x: 0, y: random() * Math.PI * 2, z: 0 },
          scale: { x: wide, y: tall, z: wide },
        },
      })
      continue
    }

    const size = 0.6 + random() * 1.4
    nodes.push({
      ...base,
      geometry: shapes[at % shapes.length] ?? shapes[0]!,
      material: {
        ...base.material,
        color: PROP_PAINTS[(at * 7) % PROP_PAINTS.length] ?? PROP_PAINTS[0]!,
        roughness: 0.7,
        metalness: 0,
      },
      transform: {
        position: { x, y: size / 2, z },
        rotation: { x: 0, y: random() * Math.PI * 2, z: 0 },
        scale: { x: size, y: size, z: size },
      },
    })
  }

  const light = directionalLight('sun')
  const sun: SceneNode = {
    ...light,
    castShadow: true,
    transform: { ...light.transform, position: sunAt(plan.azimuth, plan.elevation, SUN_DISTANCE) },
  }
  return { ...EMPTY_SCENE, nodes: [sun, ...nodes] }
}

/** Ce que le monde tient, lu sur l'état DÉJÀ bâti : le rebâtir pour compter coûterait 5 s à
 * 500 000. Écrit dans chaque relevé plutôt que déduit du seul `count`. */
export function worldShape(
  state: SceneState,
  plan: WorldPlan,
): { span: number; tiles: number; landmarks: number; props: number; clusters: number } {
  const span = spanFor(plan.count)
  let tiles = 0
  let landmarks = 0
  let props = 0
  for (const node of state.nodes) {
    if (node.type !== 'mesh') continue
    if (node.id.startsWith('tile_')) tiles += 1
    else if (node.id.startsWith('mark')) landmarks += 1
    else props += 1
  }
  return {
    span: Math.round(span),
    tiles,
    landmarks,
    props,
    clusters: plan.spread === 'clustered' ? clusterCount(span) : 0,
  }
}
