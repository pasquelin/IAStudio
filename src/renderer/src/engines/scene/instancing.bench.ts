import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D, Raycaster, Vector3 } from 'three'
import { bench, describe } from 'vitest'
import { meshNode } from './scene-fixtures'
import { createInstancedGroups } from './instancing'

const COUNT = 10_000
const geometry = new BoxGeometry()
const material = new MeshStandardMaterial()
const nodes = Array.from({ length: COUNT }, (_unused, index) => meshNode(`node-${index}`))
const objects = new Map(
  nodes.map((node, index) => {
    const mesh = new Mesh(geometry, material)
    mesh.position.set(index * 2, 0, 0)
    mesh.updateMatrixWorld(true)
    return [node.id, mesh]
  }),
)
const host = new Object3D()
const groups = createInstancedGroups(host)
groups.rebuild(nodes, id => objects.get(id))
host.updateMatrixWorld(true)
const raycaster = new Raycaster(new Vector3(COUNT, 10, 0), new Vector3(0, -1, 0))

describe('picking among 10,000 repeated meshes', () => {
  bench(
    'source mapping retained by the runtime',
    () => void raycaster.intersectObjects([...objects.values()], false),
  )
  bench(
    'instance-slot mapping alternative',
    () => void raycaster.intersectObjects([...groups.drawn()], false),
  )
})
