import {
  directionalLight,
  lightNodeFixture,
  meshNode,
} from '@/engines/scene/scene-fixtures'
import type { GeometryDescriptor } from '@shared/domain/scene'
import type { MeshNode, SceneNode } from '@/engines/scene/sceneState'

/**
 * 🛑 `meshNodes` de `scene-fixtures` ne produit que des noeuds plats et sans lumière : il ne fait
 * travailler ni `hangFromParent`, qui n'a de parent à retrouver que dans un arbre, ni
 * `tuneShadows`, qui ne mesure une portée que s'il trouve une lumière.
 */

/** Ce que mesurait le spike : aucun parent, aucune lumière. */
export const flatNodes = (count: number): SceneNode[] =>
  Array.from({ length: count }, (_unused, index) => meshNode(`node_${index}`))

/** Un arbre : la seule forme où `hangFromParent` a un parent à retrouver. */
export const treeNodes = (count: number, fanOut = 8): SceneNode[] =>
  Array.from({ length: count }, (_unused, index) =>
    meshNode(`node_${index}`, index === 0 ? null : `node_${Math.floor((index - 1) / fanOut)}`),
  )

/** Trois lampes dont deux projettent, et des corps : la forme où `tuneShadows` travaille. */
export const litNodes = (count: number): SceneNode[] => [
  directionalLight('sun'),
  lightNodeFixture('lamp', { kind: 'point', color: '#ffffff', intensity: 1, distance: 40, decay: 2 }),
  lightNodeFixture('spot', {
    kind: 'spot',
    color: '#ffffff',
    intensity: 1,
    distance: 60,
    angle: 0.6,
    penumbra: 0.4,
    decay: 2,
    target: { x: 0, y: 0, z: 0 },
  }),
  ...Array.from({ length: Math.max(0, count - 3) }, (_unused, index) => meshNode(`node_${index}`)),
]

/**
 * Ce qu'une scène d'atelier contient vraiment : plusieurs formes et plusieurs matières. Le
 * regroupement en instances a un plancher de 64 noeuds PAR GROUPE, et la clé d'un groupe est la
 * géométrie ET le matériau — une scène variée n'en remplit aucun.
 */
export const mixedNodes = (count: number): MeshNode[] =>
  Array.from({ length: count }, (_unused, index) => {
    const node = meshNode(`node_${index}`)
    return {
      ...node,
      geometry: SHAPES_OF[index % SHAPES_OF.length] ?? node.geometry,
      material: { ...node.material, color: COLOURS[index % COLOURS.length] ?? '#ffffff' },
    }
  })

const SHAPES_OF: GeometryDescriptor[] = [
  { kind: 'box', width: 1, height: 1, depth: 1 },
  { kind: 'sphere', radius: 1, widthSegments: 16, heightSegments: 12 },
  { kind: 'cylinder', radiusTop: 1, radiusBottom: 1, height: 2, segments: 16 },
]

const COLOURS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#888888']

export const SHAPES = {
  plate: flatNodes,
  arbre: treeNodes,
  ombres: litNodes,
  variee: mixedNodes,
}

export type ShapeName = keyof typeof SHAPES

/** Dérivé plutôt que recopié : une forme neuve entre dans les deux bancs sans qu'on y pense. */
export const SHAPE_NAMES = Object.keys(SHAPES) as ShapeName[]
