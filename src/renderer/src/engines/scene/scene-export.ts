import { Group, type Object3D, type Texture } from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js'
import { decompress } from 'three/addons/utils/WebGLTextureUtils.js'
import type { ExportFormat } from '@shared/domain/scene'

/**
 * A scene on its way out of the studio.
 *
 * What is exported is the objects the document describes, and nothing else: the grid, the
 * trihedron, the gizmo and the light helpers are siblings of the nodes in the viewport rather
 * than children of one, so handing over the node objects leaves them behind by construction.
 *
 * Copies are handed over rather than the objects themselves. Three reasons, all of them ones a
 * file would otherwise show: the exporters write a *local* transform, so a selected child would
 * land where it sits inside its parent rather than where it sits in the scene; `USDZExporter`
 * takes a single root, and gathering several under one would mean pulling them out of the
 * viewport mid-export; and the wireframe overlay is the one thing that really is a child of a
 * mesh, so it is dropped from the copy instead of hidden in the original.
 */

const OVERLAY_NAME = 'wireframe-overlay'

/**
 * How a compressed texture becomes one an exporter can write. Neither format holds a GPU
 * compression scheme, and neither exporter skips what it cannot write — both throw, losing the
 * whole file over a picture. KTX2 is wired into the model loader, so an imported model wearing
 * one is ordinary rather than exotic.
 */
export type TextureDecoder = { decompress: (texture: Texture) => Texture }

/**
 * Decoded on a renderer of its own, made and thrown away inside the call — which is what handing
 * `decompress` no renderer asks it to do. The viewport's own must not be handed over: `decompress`
 * calls `setSize` on whatever it is given, and would resize the canvas being looked at.
 */
const compressedTextureDecoder: TextureDecoder = {
  decompress: texture => decompress(texture),
}

export async function exportObjects(
  objects: readonly Object3D[],
  format: ExportFormat,
  decoder: TextureDecoder = compressedTextureDecoder,
): Promise<Uint8Array> {
  const roots = objects.map(placedCopy)

  if (format !== 'usdz') return toGltf(roots, format, decoder)

  const exporter = new USDZExporter()
  exporter.setTextureUtils(decoder)

  // `USDZExporter` takes one root, so several are handed to it under a group of no consequence.
  const [only] = roots
  if (roots.length === 1 && only) return exporter.parseAsync(only)

  const root = new Group()
  root.add(...roots)
  return exporter.parseAsync(root)
}

/**
 * A copy standing where the original stands in the world. Geometries and materials are shared
 * rather than duplicated — `clone` keeps the references — so the copy costs objects, not buffers.
 */
export function placedCopy(object: Object3D): Object3D {
  const copy = object.clone()

  object.updateWorldMatrix(true, false)
  object.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale)
  // `clone` carried the original's `matrix` over, and decomposing writes the three components
  // beside it rather than through it. `USDZExporter` reads that matrix and never refreshes it,
  // so without this the placement above reaches glTF — which does refresh — and nothing else.
  copy.updateMatrix()

  dropOverlays(copy)
  return copy
}

function dropOverlays(object: Object3D): void {
  // Collected first: removing a child mid-walk would skip the one that takes its place.
  const overlays: Object3D[] = []
  object.traverse(child => {
    if (child.name === OVERLAY_NAME) overlays.push(child)
  })

  for (const overlay of overlays) overlay.removeFromParent()
}

async function toGltf(
  roots: readonly Object3D[],
  format: Exclude<ExportFormat, 'usdz'>,
  decoder: TextureDecoder,
): Promise<Uint8Array> {
  const binary = format === 'glb'
  const exporter = new GLTFExporter()
  exporter.setTextureUtils(decoder)

  // An array, not a wrapper group: `GLTFExporter` takes several roots, and wrapping them would
  // add a node the document never held.
  const result = await exporter.parseAsync([...roots], { binary })

  if (result instanceof ArrayBuffer) return new Uint8Array(result)
  // `.gltf` is JSON, and what a text file holds is its bytes: the encoding is the writer's, and
  // the writer is the main process.
  return new TextEncoder().encode(JSON.stringify(result))
}
