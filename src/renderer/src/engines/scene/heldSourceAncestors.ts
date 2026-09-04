import type { Mesh, Object3D } from 'three'

export function heldSourceAncestors(): {
  replace: (meshes: readonly Mesh[]) => void
  beneath: (objects: ReadonlySet<Object3D>) => ReadonlySet<Mesh>
} {
  let byAncestor = new WeakMap<Object3D, Mesh[]>()

  return {
    replace: meshes => {
      byAncestor = new WeakMap<Object3D, Mesh[]>()
      for (const mesh of meshes) {
        let ancestor = mesh.parent
        while (ancestor) {
          const below = byAncestor.get(ancestor)
          if (below) below.push(mesh)
          else byAncestor.set(ancestor, [mesh])
          ancestor = ancestor.parent
        }
      }
    },
    beneath: objects => {
      const meshes = new Set<Mesh>()
      for (const object of objects) {
        for (const mesh of byAncestor.get(object) ?? []) meshes.add(mesh)
      }
      return meshes
    },
  }
}
