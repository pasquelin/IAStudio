import {
  DirectionalLight,
  Group,
  Object3D,
  SpotLight,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { decompress } from 'three/addons/utils/WebGLTextureUtils.js'
import type { ExportFormat } from '@shared/domain/scene'
import { OVERLAY_NAME } from './sceneView'

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

/**
 * How a compressed texture becomes one an exporter can write. Neither format holds a GPU
 * compression scheme, and neither exporter skips what it cannot write — both throw, losing the
 * whole file over a picture. KTX2 is wired into the model loader, so an imported model wearing
 * one is ordinary rather than exotic.
 */
export type TextureDecoder = { decompress: (texture: Texture) => Texture }

type OwnedDecoder = TextureDecoder & { dispose: () => void }

/**
 * One renderer for the whole export rather than one per texture.
 *
 * Handed no renderer, `decompress` builds a `WebGLRenderer` and destroys it again on every
 * single call — and it is called per map slot, so a model wearing four compressed maps opened
 * and lost four GPU contexts. A browser hands out about sixteen and evicts the OLDEST when it
 * runs short, so what goes black is a viewport somebody was looking at.
 *
 * Its own, never the viewport's: `decompress` calls `setSize` on whatever it is given, and would
 * resize the canvas being looked at. Built lazily — an export with no compressed texture, which
 * is nearly all of them, must not open a context to find that out.
 */
function ownedDecoder(): OwnedDecoder {
  let renderer: WebGLRenderer | null = null

  return {
    decompress: texture => {
      renderer ??= new WebGLRenderer({ antialias: false })
      return decompress(texture, Infinity, renderer)
    },
    dispose: () => {
      if (!renderer) return
      renderer.dispose()
      // `dispose` frees three's own objects; the context itself only goes with this.
      renderer.forceContextLoss()
      renderer = null
    },
  }
}

export type ExportOptions = {
  /**
   * What the document calls a node, read by the id its object carries. Without it a file names
   * its meshes with UUIDs — the picking identity, which is the studio's business and nobody
   * else's.
   */
  nameOf?: (id: string) => string | undefined
  /** Injected by the tests: jsdom has no WebGL, so nothing can decode a compressed texture. */
  decoder?: TextureDecoder
}

export async function exportObjects(
  objects: readonly Object3D[],
  format: ExportFormat,
  { nameOf, decoder }: ExportOptions = {},
): Promise<Uint8Array> {
  // Said rather than written: both exporters default to `onlyVisible`, so a hidden node used to
  // produce a valid, empty file — and nothing on screen distinguished that from a success.
  if (objects.length > 0 && objects.every(object => !object.visible)) {
    throw new Error('nothing visible to export')
  }

  const owned = decoder ? null : ownedDecoder()

  try {
    const roots = objects.map(object => placedCopy(object, nameOf))
    return await write(roots, format, decoder ?? owned ?? ownedDecoder())
  } finally {
    owned?.dispose()
  }
}

function write(
  roots: readonly Object3D[],
  format: ExportFormat,
  decoder: TextureDecoder,
): Promise<Uint8Array> {
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
export function placedCopy(
  object: Object3D,
  nameOf?: (id: string) => string | undefined,
): Object3D {
  // `SkeletonUtils.clone` rather than `clone`: `SkinnedMesh.copy` keeps the ORIGINAL's skeleton,
  // whose bones live outside the copied subtree. glTF then writes `"joints":[null,null]` — a file
  // no viewer opens — and this one call rebinds each copied mesh onto the copied bones.
  const copy = cloneSkinned(object)

  object.updateWorldMatrix(true, false)
  object.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale)
  aimAtTarget(object, copy)
  // `clone` carried the original's `matrix` over, and decomposing writes the three components
  // beside it rather than through it. `USDZExporter` reads that matrix and never refreshes it,
  // so without this the placement above reaches glTF — which does refresh — and nothing else.
  copy.updateMatrix()

  dropOverlays(copy)
  if (nameOf) rename(copy, nameOf)
  return copy
}

/**
 * A directional or spot light points at a target that is a SIBLING of the nodes, so it never
 * travels with the copy and the light lands in the file aimed down its default axis. glTF has no
 * target at all — `KHR_lights_punctual` reads the node's own −Z — and three says as much on the
 * way out: "make light.target a child of the light with position 0,0,-1".
 *
 * So the copy is turned to look where the original looked, and given a target of its own there.
 */
function aimAtTarget(object: Object3D, copy: Object3D): void {
  if (!(object instanceof DirectionalLight) && !(object instanceof SpotLight)) return
  if (!(copy instanceof DirectionalLight) && !(copy instanceof SpotLight)) return

  object.target.updateWorldMatrix(true, false)
  // `lookAt` on a light aims its −Z, which is the axis the exporters read.
  copy.lookAt(new Vector3().setFromMatrixPosition(object.target.matrixWorld))

  copy.target = new Object3D()
  copy.target.position.set(0, 0, -1)
  copy.add(copy.target)
}

/**
 * The name the document gave a node, in place of the id its object wears. That id is the picking
 * identity — `nodeIdOf` reads it back off a hit — so it cannot be changed in the viewport, and a
 * file full of UUIDs is what came out of exporting the objects as they stand.
 */
function rename(root: Object3D, nameOf: (id: string) => string | undefined): void {
  root.traverse(child => {
    const name = nameOf(child.name)
    if (name) child.name = name
  })
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
