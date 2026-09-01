import { directionalLight, meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type MeshNode, type SceneNode, type SceneState } from '@/engines/scene/sceneState'
import type { GeometryDescriptor } from '@shared/domain/geometry'

/**
 * Les trois scènes du chantier C, en ÉTAT du studio : c'est `SceneRenderer.apply` qui bâtit les
 * meshes, jamais le banc. Un soleil qui projette dans chacune, parce que le produit livre les
 * ombres allumées par défaut.
 */

/** Les dix-huit groupes du banc du plancher, repris tels quels : c'est la scène S1. */
export const S1_GROUPS = [4, 8, 12, 20, 30, 45, 60, 8, 16, 24, 40, 55, 12, 36, 50, 60, 20, 44]

const FIVE_SHAPES: GeometryDescriptor[] = [
  { kind: 'box', width: 1, height: 1, depth: 1 },
  { kind: 'sphere', radius: 0.6, widthSegments: 20, heightSegments: 14 },
  { kind: 'cylinder', radiusTop: 0.5, radiusBottom: 0.5, height: 1.2, segments: 18 },
  { kind: 'capsule', radius: 0.4, height: 0.8, capSegments: 4, radialSegments: 12 },
  { kind: 'torusKnot', radius: 0.45, tube: 0.15, tubularSegments: 48, radialSegments: 10, p: 2, q: 3 },
]

const THREE_SHAPES: GeometryDescriptor[] = [
  { kind: 'box', width: 1, height: 1, depth: 1 },
  { kind: 'sphere', radius: 0.6, widthSegments: 16, heightSegments: 12 },
  { kind: 'cylinder', radiusTop: 0.5, radiusBottom: 0.5, height: 1.2, segments: 16 },
]

const EIGHT_PAINTS = ['#ff5544', '#44ff66', '#4466ff', '#ffee44', '#ff44dd', '#44eeff', '#eeeeee', '#888888']

const hsl = (share: number): string => {
  const h = (share % 1) * 360
  return `hsl(${Math.round(h)}, 50%, 55%)`
}

/** Une grille cubique, comme `floorScenes.place` : le corps `index` sur `total`. */
const onGrid = (index: number, total: number): { x: number; y: number; z: number } => {
  const side = Math.ceil(Math.cbrt(total))
  const half = (side - 1) / 2
  return {
    x: ((index % side) - half) * 2.6,
    y: ((Math.floor(index / side) % side) - half) * 2.6,
    z: (Math.floor(index / (side * side)) - half) * 2.6,
  }
}

const sun = (): SceneNode => {
  const light = directionalLight('sun')
  return { ...light, castShadow: true, transform: { ...light.transform, position: { x: 40, y: 70, z: 30 } } }
}

const withState = (nodes: SceneNode[]): SceneState => ({ ...EMPTY_SCENE, nodes: [sun(), ...nodes] })

/** S1 : 544 corps en 18 groupes de 4 à 60, cinq formes, un matériau par groupe, cartes sur un sur deux. */
export function sceneS1(): SceneState {
  const total = S1_GROUPS.reduce((sum, size) => sum + size, 0)
  const nodes: MeshNode[] = []
  let index = 0
  for (const [group, size] of S1_GROUPS.entries()) {
    const geometry = FIVE_SHAPES[group % FIVE_SHAPES.length] ?? FIVE_SHAPES[0]!
    for (let copy = 0; copy < size; copy++) {
      const base = meshNode(`g${group}_${copy}`)
      nodes.push({
        ...base,
        geometry,
        material: {
          ...base.material,
          color: hsl(group / S1_GROUPS.length),
          roughness: 0.2 + (group % 4) * 0.2,
          metalness: group % 3 === 0 ? 0.8 : 0.1,
          map: group % 2 === 0 ? { assetId: 'checker' } : null,
        },
        transform: { ...base.transform, position: onGrid(index, total) },
      })
      index++
    }
  }
  return withState(nodes)
}

/** mulberry32 : le même tirage à chaque passe, donc la même scène des deux côtés du flag. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** S2 et S3 : N corps, trois formes × huit peintures, placés, tournés et mis à l'échelle au hasard. */
export function sceneVaried(count: number, seed = 7): SceneState {
  const random = seeded(seed)
  const reach = Math.ceil(Math.cbrt(count)) * 1.3
  const nodes: MeshNode[] = []
  for (let at = 0; at < count; at++) {
    const base = meshNode(`v${at}`)
    const scale = 0.6 + random() * 0.8
    nodes.push({
      ...base,
      geometry: THREE_SHAPES[at % THREE_SHAPES.length] ?? THREE_SHAPES[0]!,
      material: { ...base.material, color: EIGHT_PAINTS[(at * 7) % EIGHT_PAINTS.length] ?? '#ffffff' },
      transform: {
        position: { x: (random() - 0.5) * 2 * reach, y: (random() - 0.5) * 2 * reach, z: (random() - 0.5) * 2 * reach },
        rotation: { x: random() * Math.PI * 2, y: random() * Math.PI * 2, z: random() * Math.PI * 2 },
        scale: { x: scale, y: scale, z: scale },
      },
    })
  }
  return withState(nodes)
}

/** Un tableau neuf, aucun noeud d'identité neuve : ce que `studioRender` remet quand rien ne bouge. */
export const withNothingMoved = (state: SceneState): SceneState => ({ ...state, nodes: [...state.nodes] })

/** Un tableau neuf, UN noeud d'identité neuve — le `at`-ième corps, jamais le soleil. */
export const withOneMoved = (state: SceneState, at: number): SceneState => {
  const bodies = state.nodes.length - 1
  const index = 1 + (at % bodies)
  return {
    ...state,
    nodes: state.nodes.map((node, where) =>
      where === index
        ? { ...node, transform: { ...node.transform, position: { ...node.transform.position, y: node.transform.position.y + 0.01 * (at + 1) } } }
        : node,
    ),
  }
}

/** Un corps de plus, en fin de liste : ce qu'un ajout coûte, regroupement compris. */
export const withOneAdded = (state: SceneState): SceneState => {
  const base = meshNode('added')
  return {
    ...state,
    nodes: [
      ...state.nodes,
      { ...base, geometry: THREE_SHAPES[0]!, material: { ...base.material, color: EIGHT_PAINTS[0] ?? null } },
    ],
  }
}

/** Les centres des corps, pour compter ce qu'une caméra tient dans son champ. */
export const centresOf = (state: SceneState): { x: number; y: number; z: number }[] =>
  state.nodes.filter(node => node.type === 'mesh').map(node => node.transform.position)

/** La même scène sans aucune carte : pour isoler ce qu'une texture coûte ou casse. */
export const withoutMaps = (state: SceneState): SceneState => ({
  ...state,
  nodes: state.nodes.map(node => (node.type === 'mesh' ? { ...node, material: { ...node.material, map: null } } : node)),
})
