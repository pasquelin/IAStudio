import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import { PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'
import { meshNode, walked } from './scene-fixtures'
import { isDrawn, WORTH_INSTANCING } from './grouping'
import { createCellGroups } from './cellInstancing'
import { CELL_SIZE } from './worldPartition'
import type { Component } from '@shared/domain/component'
import type { SceneNode } from './sceneState'

/** Bodies of one shape, laid out by the caller — which is the whole of what a cell is decided by. */
function bodies(
  places: readonly number[],
  geometry: BoxGeometry = new BoxGeometry(1, 1, 1),
  z = 0,
  named = 'n',
): { nodes: SceneNode[]; objects: Map<string, Mesh> } {
  const nodes: SceneNode[] = []
  const objects = new Map<string, Mesh>()
  const material = new MeshStandardMaterial()

  for (const [at, x] of places.entries()) {
    const node = meshNode(`${named}${at}`)
    const mesh = new Mesh(geometry, material)
    mesh.position.set(x, 0, z)
    mesh.updateMatrixWorld(true)
    nodes.push(node)
    objects.set(node.id, mesh)
  }
  return { nodes, objects }
}

/** Beside the camera, in the NEXT cell along z, and inside a view of 500 that turns to it. */
const ASIDE_AT = CELL_SIZE + 20

/**
 * One lot over TWO cells of the same zone: one ahead of the camera, one beside it. The shape and
 * the paint are shared, so the two are one group cut in two by the grid — the case the box is for.
 */
function aheadAndAside(): {
  scene: Object3D
  groups: ReturnType<typeof createCellGroups>
} {
  const scene = host()
  const shape = new BoxGeometry(1, 1, 1)
  const ahead = bodies(inOneCell(WORTH_INSTANCING, 20), shape, 0, 'a')
  const aside = bodies(inOneCell(WORTH_INSTANCING, 0), shape, ASIDE_AT, 'b')
  const objects = new Map([...ahead.objects, ...aside.objects])
  // The same material object on both, so the spelling of the group is the same one.
  for (const mesh of aside.objects.values()) {
    const first = ahead.objects.get('a0')
    if (first) mesh.material = first.material
  }
  const groups = createCellGroups(scene)
  groups.rebuild([...ahead.nodes, ...aside.nodes], id => objects.get(id))
  return { scene, groups }
}

/** `count` bodies inside one cell, around `x`. */
const inOneCell = (count: number, x: number): number[] =>
  Array.from({ length: count }, (_unused, at) => x + at)

/** What a body says of itself when a system drives it — the declared path. */
const MOVES: Component = { type: 'Movement' }

const host = (): Object3D => new Object3D()

const cellsIn = (scene: Object3D): Group[] => scene.children.filter(child => child instanceof Group)

const instancesIn = (scene: Object3D): InstancedMesh[] =>
  walked(scene).filter(child => child instanceof InstancedMesh)

/** Two cells a level apart, already built — what both the zone and a rebuild are read on. */
const twoCells = (): {
  scene: Object3D
  groups: ReturnType<typeof createCellGroups>
  nodes: SceneNode[]
  objects: Map<string, Mesh>
} => {
  const scene = host()
  const { nodes, objects } = bodies([
    ...inOneCell(WORTH_INSTANCING, 0),
    ...inOneCell(WORTH_INSTANCING, 20 * CELL_SIZE),
  ])
  const groups = createCellGroups(scene)
  groups.rebuild(nodes, id => objects.get(id))
  return { scene, groups, nodes, objects }
}

/** What three would really draw: the instance visible, and every group it hangs from with it. */
const drawnIn = (scene: Object3D): InstancedMesh[] =>
  instancesIn(scene).filter(mesh => isDrawn(mesh, scene))

/** Where each cell the scene still holds stands, along x — one number per cell, sorted. */
const standingIn = (scene: Object3D): number[] =>
  cellsIn(scene)
    .flatMap(cell => cell.children.filter(child => child instanceof InstancedMesh))
    .map(mesh => mesh.instanceMatrix.array[12] ?? 0)
    .toSorted((one, other) => one - other)

/** A view of `far` from where it stands, aimed along `at` — what decides what is drawn. */
function looking(
  x: number,
  far: number,
  at: { x: number; z: number } = { x: 1, z: 0 },
): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, far)
  camera.position.set(x, 0, 0)
  camera.lookAt(x + at.x, 0, at.z)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}

describe('createCellGroups', () => {
  it('leaves an ordinary scene alone, drawing nothing of its own', () => {
    const scene = host()
    const { nodes, objects } = bodies(inOneCell(WORTH_INSTANCING - 1, 0))

    expect(createCellGroups(scene).rebuild(nodes, id => objects.get(id))).toBe(0)
    expect(scene.children).toHaveLength(0)
  })

  it('draws a repeated shape through one instance per cell of the world', () => {
    const scene = host()
    const { nodes, objects } = bodies([
      ...inOneCell(WORTH_INSTANCING, 0),
      ...inOneCell(WORTH_INSTANCING, 4 * CELL_SIZE),
    ])

    const count = createCellGroups(scene).rebuild(nodes, id => objects.get(id))

    // Two cells, two calls — where the triangle budget answers ONE region covering both, and
    // draws all thirty-two bodies whatever the view. That is the whole of the gain.
    expect(count).toBe(2 * WORTH_INSTANCING)
    expect(cellsIn(scene)).toHaveLength(2)
    expect(instancesIn(scene)).toHaveLength(2)
  })

  it('carries the shadow flags of the meshes it draws for', () => {
    const scene = host()
    const { nodes, objects } = bodies(inOneCell(WORTH_INSTANCING, 0))
    for (const mesh of objects.values()) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }

    createCellGroups(scene).rebuild(nodes, id => objects.get(id))

    // The sources sit on a layer the shadow camera never looks at: left at their default, a
    // whole cell would neither cast a shadow nor catch one.
    const instance = instancesIn(scene)[0]
    expect({ cast: instance?.castShadow, receive: instance?.receiveShadow }).toEqual({
      cast: true,
      receive: true,
    })
  })

  it('leaves the matrices of what it draws at identity, which is where they belong', () => {
    const scene = host()
    const { nodes, objects } = bodies(inOneCell(WORTH_INSTANCING, 0))
    createCellGroups(scene).rebuild(nodes, id => objects.get(id))

    scene.updateMatrixWorld(true)

    // The instance holds WORLD matrices, so its own must stay identity — that is what makes it
    // safe to leave the cell out of the walk, and what the frustum tests it by.
    expect(instancesIn(scene)[0]?.matrixWorld.equals(new Matrix4())).toBe(true)
  })

  it('draws a body too wide for a cell apart from the cells', () => {
    const scene = host()
    const wide = new BoxGeometry(4 * CELL_SIZE, 1, 4 * CELL_SIZE)
    const { nodes, objects } = bodies(inOneCell(WORTH_INSTANCING, 0), wide)

    createCellGroups(scene).rebuild(nodes, id => objects.get(id))

    // Filed in one cell, it would stand across four and go with the first of them to leave the
    // zone — taking its shadow with it. It hangs from the host instead, which no zone turns off.
    expect(cellsIn(scene)).toHaveLength(0)
    expect(scene.children.filter(child => child instanceof InstancedMesh)).toHaveLength(1)
  })
})

describe('the zone a camera holds', () => {
  it('draws every cell until a camera says where it stands', () => {
    const { scene } = twoCells()

    // The resting state, and it is what makes the flag safe: an engine that never follows a
    // camera draws exactly what it drew before.
    expect(standingIn(scene)).toEqual([0, 20 * CELL_SIZE])
  })

  it('takes the cells the view cannot reach out of the scene', () => {
    const { scene, groups } = twoCells()

    const moved = groups.follow?.(looking(0, 500))

    // 🛑 OUT of it, not merely turned off: `visible` stops `projectObject` and nothing else, and
    // `updateMatrixWorld` walks every child whatever the flag says — 0.97 ms a frame of pure
    // walking on 6 912 meshes that draw nothing.
    expect(moved).toBe(true)
    expect(standingIn(scene)).toEqual([0])
  })

  it('puts them back when the camera comes to them', () => {
    const { scene, groups } = twoCells()
    groups.follow?.(looking(0, 500))

    groups.follow?.(looking(20 * CELL_SIZE, 500))

    expect(standingIn(scene)).toEqual([20 * CELL_SIZE])
  })

  it('says nothing moved when the camera stayed in its zone', () => {
    const { groups } = twoCells()
    groups.follow?.(looking(0, 500))

    // What the answer is READ for: it is what asks for the shadow maps to be drawn again, and a
    // still viewport must not ask for one per frame.
    expect(groups.follow?.(looking(1, 500))).toBe(false)
  })

  it('draws every cell again for a render that names no camera', () => {
    const { scene, groups } = twoCells()
    groups.follow?.(looking(0, 500))

    groups.follow?.(null)

    // A film, a capture and a preview render from a camera of their own without ever following
    // one. A zone narrowed for the viewport would cut bodies out of what they write.
    expect(standingIn(scene)).toEqual([0, 20 * CELL_SIZE])
  })

  it('draws a whole level from a view wide enough to hold it', () => {
    const { scene, groups } = twoCells()

    groups.follow?.(looking(0, 40 * CELL_SIZE))

    // The pixel-for-pixel case: nothing a view could show is ever left out, so an ordinary scene
    // under the flag draws exactly the image it drew without it.
    expect(standingIn(scene)).toEqual([0, 20 * CELL_SIZE])
  })
})

describe('the box a bucket really occupies', () => {
  it('stops drawing what the view cannot reach, without moving its cell out of the scene', () => {
    const { scene, groups } = aheadAndAside()

    groups.follow?.(looking(0, 500))

    // 🛑 Measured on 500 000 bodies: the box rejects 155 of the 381 calls three's SPHERE lets
    // through, and every one of them was drawing no visible instance at all. The cell stays in
    // the scene — the zone is a disc on purpose, and what a shadow needs is not what a view does.
    expect(cellsIn(scene)).toHaveLength(2)
    const shown = drawnIn(scene)
    expect(shown).toHaveLength(1)
    expect(shown[0]?.instanceMatrix.array[14]).toBe(0)
  })

  it('draws it again once the camera turns to it', () => {
    const { scene, groups } = aheadAndAside()
    groups.follow?.(looking(0, 500))

    groups.follow?.(looking(0, 500, { x: 0, z: 1 }))

    const shown = drawnIn(scene)
    expect(shown).toHaveLength(1)
    expect(shown[0]?.instanceMatrix.array[14]).toBe(ASIDE_AT)
  })

  it('draws every bucket again for a render that names no camera', () => {
    const { scene, groups } = aheadAndAside()
    groups.follow?.(looking(0, 500))

    groups.follow?.(null)

    expect(drawnIn(scene)).toHaveLength(instancesIn(scene).length)
  })
})

describe('the shadow a rejected bucket would have thrown', () => {
  /** Un soleil bas en +z : les ombres partent vers -z, donc vers l'axe où la caméra regarde. */
  const LOW_SUN = { x: 0, y: -0.316, z: -0.948, floor: -100 }

  it('keeps a bucket out of the view whose shadow falls into it', () => {
    const { scene, groups } = aheadAndAside()
    groups.follow?.(looking(0, 500))
    expect(drawnIn(scene)).toHaveLength(1)

    groups.follow?.(looking(0, 500), LOW_SUN)

    // Hiding a caster hides its shadow with it: `WebGLShadowMap.renderObject` returns on
    // `visible === false` and tests `layers` against the VIEW camera, so neither flag can spare
    // one pass and not the other. Measured on pillars just out of frame: 2.0 % of the pixels
    // lost their shadow, and it came back the moment the camera turned to them.
    expect(drawnIn(scene)).toHaveLength(2)
  })

  it('hides it again under a sun overhead, whose shadow falls under the body', () => {
    const { scene, groups } = aheadAndAside()

    groups.follow?.(looking(0, 500), { x: 0, y: -1, z: 0, floor: -1 })

    expect(drawnIn(scene)).toHaveLength(1)
  })
})

describe('a cell whose bodies moved without changing cell', () => {
  it('is measured again, so a body carried back into view is drawn again', () => {
    const scene = host()
    const shape = new BoxGeometry(1, 1, 1)
    // Off to the side of a view aimed along x, but in the cell the camera stands in.
    const { nodes, objects } = bodies(inOneCell(WORTH_INSTANCING, 20), shape, 200)
    const groups = createCellGroups(scene)
    groups.rebuild(nodes, id => objects.get(id))
    groups.follow?.(looking(0, 500))
    expect(drawnIn(scene)).toHaveLength(0)

    for (const mesh of objects.values()) {
      mesh.position.setZ(0)
      mesh.updateMatrixWorld(true)
    }
    groups.rebuild(nodes, id => objects.get(id))
    groups.follow?.(looking(0, 500))

    expect(drawnIn(scene)).toHaveLength(1)
  })
})

describe('a body dragged into view', () => {
  it('brings its whole cell back with it, without any rebuild', () => {
    const scene = host()
    const shape = new BoxGeometry(1, 1, 1)
    // Off to the side of a view aimed along x: the cell is standing and drawn by nobody.
    const { nodes, objects } = bodies(inOneCell(WORTH_INSTANCING, 20), shape, 200)
    const groups = createCellGroups(scene)
    groups.rebuild(nodes, id => objects.get(id))
    groups.follow?.(looking(0, 500))
    expect(drawnIn(scene)).toHaveLength(0)

    // A drag reports through `moved` alone — a body keeps its cell until a change of CONTENT.
    const dragged = objects.get('n0')
    if (!dragged) throw new Error('no body to drag')
    dragged.position.set(20, 0, 0)
    dragged.updateMatrixWorld(true)
    groups.moved(['n0'], id => objects.get(id))
    groups.follow?.(looking(0, 500))

    // The cell's box is the union of its lots'. Grown on the lot alone, the cell stayed where its
    // bodies STOOD and took the dragged one off screen with it, for the length of the gesture.
    expect(drawnIn(scene)).toHaveLength(1)
  })
})

describe('what the strategy publishes of its own index', () => {
  it('says what the last query walked, and what the scene now holds', () => {
    const { groups } = twoCells()

    groups.follow?.(looking(0, 500))

    // Nothing in the studio could see this before: the count lived in the spike alone.
    expect(groups.stats?.()).toMatchObject({ cells: 2, cellsStanding: 1, cellsReturned: 1 })
    expect(groups.stats?.().nodesVisited).toBeGreaterThan(0)
  })
})

describe('a rebuild after a change of content', () => {
  it('keeps the cells nothing touched, and builds again only the one that changed', () => {
    const { groups, nodes, objects } = twoCells()
    const [near, far] = groups.drawn()

    // One body deleted from the far cell. The near one holds the same bodies in the same slots.
    groups.rebuild(nodes.slice(0, -1), id => objects.get(id))

    const now = groups.drawn()
    expect(now).toContain(near)
    expect(now).not.toContain(far)
  })

  it('draws for one body fewer once it is gone', () => {
    const { groups, nodes, objects } = twoCells()

    groups.rebuild(nodes.slice(0, -1), id => objects.get(id))

    const counts = groups.drawn().map(mesh => (mesh instanceof InstancedMesh ? mesh.count : 0))
    expect(counts.toSorted()).toEqual([WORTH_INSTANCING - 1, WORTH_INSTANCING])
  })

  it('forgets a cell nothing stands in any more', () => {
    const { scene, groups, nodes, objects } = twoCells()

    groups.rebuild(nodes.slice(0, WORTH_INSTANCING), id => objects.get(id))

    expect(cellsIn(scene)).toHaveLength(1)
  })

  it('rebuilds nothing at all when nothing moved', () => {
    const { groups, nodes, objects } = twoCells()
    const held = groups.drawn()

    groups.rebuild(nodes, id => objects.get(id))

    expect(groups.drawn()).toEqual(held)
  })

  it('writes the matrix of a body carried elsewhere inside its own cell', () => {
    const { groups, nodes, objects } = twoCells()
    const mesh = objects.get('n0')
    if (!mesh) throw new Error('no body to carry')

    mesh.position.set(0, 7, 0)
    mesh.updateMatrixWorld(true)
    groups.rebuild(nodes, id => objects.get(id))

    // The cell holds the same bodies in the same slots, so nothing structural says it changed —
    // and a rebuild that trusted that would leave the body where it stood.
    const instance = groups.drawn()[0]
    expect(instance instanceof InstancedMesh && instance.instanceMatrix.array[13]).toBe(7)
  })
})

describe('a body that DECLARES it moves', () => {
  const declared = (): {
    scene: Object3D
    groups: ReturnType<typeof createCellGroups>
    nodes: SceneNode[]
    objects: Map<string, Mesh>
  } => {
    const scene = host()
    const { nodes, objects } = bodies(inOneCell(WORTH_INSTANCING, 0))
    const said = nodes.map(node => (node.id === 'n2' ? { ...node, components: [MOVES] } : node))
    const groups = createCellGroups(scene)
    groups.rebuild(said, id => objects.get(id))
    return { scene, groups, nodes: said, objects }
  }

  const moverLot = (scene: Object3D): InstancedMesh | undefined =>
    scene.children.find(child => child instanceof InstancedMesh)

  it('is never put in a cell in the first place', () => {
    const { scene, groups } = declared()

    // 🛑 Déclaré, pas déduit : le document dit ce qu'un corps fait, et le premier mouvement n'a
    // plus rien à promouvoir. Une cellule n'est donc jamais défaite pour lui.
    expect(moverLot(scene)?.count).toBe(1)
    const cell = groups.drawn()[0]
    expect(cell instanceof InstancedMesh && cell.count).toBe(WORTH_INSTANCING - 1)
  })

  it('costs nothing to move, since there is nothing left to promote', () => {
    const { scene, groups, objects } = declared()
    const cell = groups.drawn()[0]
    const mesh = objects.get('n2')
    if (!mesh) throw new Error('no body to move')
    mesh.position.set(0, 5, 0)
    mesh.updateMatrixWorld(true)

    groups.moved(['n2'], id => objects.get(id))

    expect(groups.drawn()).toContain(cell)
    expect(moverLot(scene)?.instanceMatrix.array[13]).toBe(5)
  })

  it('keeps its slot across a change of content', () => {
    const { scene, groups, nodes, objects } = declared()

    groups.rebuild(nodes, id => objects.get(id))

    expect(moverLot(scene)?.count).toBe(1)
  })

  it('goes back to the grid once it stops declaring it', () => {
    const { scene, groups, nodes, objects } = declared()

    groups.rebuild(
      nodes.map(node => ({ ...node, components: [] })),
      id => objects.get(id),
    )

    expect(moverLot(scene)?.count).toBe(0)
    const cell = groups.drawn().find(mesh => mesh instanceof InstancedMesh && mesh.count > 1)
    expect(cell instanceof InstancedMesh && cell.count).toBe(WORTH_INSTANCING)
  })
})

describe('a body that moves without declaring it', () => {
  const moving = (): {
    scene: Object3D
    groups: ReturnType<typeof createCellGroups>
    objects: Map<string, Mesh>
    nodes: SceneNode[]
    cell: InstancedMesh
  } => {
    const scene = host()
    const { nodes, objects } = bodies(inOneCell(WORTH_INSTANCING, 0))
    const groups = createCellGroups(scene)
    groups.rebuild(nodes, id => objects.get(id))
    const cell = groups.drawn()[0]
    if (!(cell instanceof InstancedMesh)) throw new Error('the cell was never built')
    return { scene, groups, objects, nodes, cell }
  }

  const shove = (
    groups: ReturnType<typeof createCellGroups>,
    objects: Map<string, Mesh>,
    id: string,
    y: number,
  ): boolean => {
    const mesh = objects.get(id)
    if (!mesh) throw new Error(`no body ${id}`)
    mesh.position.set(0, y, 0)
    mesh.updateMatrixWorld(true)
    return groups.moved([id], held => objects.get(held))
  }

  /** The lot of movers: hung from the host, and the only mesh outside every cell group. */
  const moverLot = (scene: Object3D): InstancedMesh | undefined =>
    scene.children.find(child => child instanceof InstancedMesh)

  it('leaves the grid for a lot of its own, without rebuilding its cell', () => {
    const { scene, groups, objects, cell } = moving()

    expect(shove(groups, objects, 'n2', 3)).toBe(true)

    // The SAME cell object, one body lighter — no rebuild — and the mover drawn beside it.
    expect(groups.drawn()).toContain(cell)
    expect(cell.count).toBe(WORTH_INSTANCING - 1)
    expect(moverLot(scene)?.count).toBe(1)
  })

  it('is written where it now stands', () => {
    const { scene, groups, objects } = moving()

    shove(groups, objects, 'n2', 3)

    expect(moverLot(scene)?.instanceMatrix.array[13]).toBe(3)
  })

  it('fills the hole it left with the LAST body, rather than shifting the rest', () => {
    const { groups, objects, cell } = moving()

    shove(groups, objects, 'n2', 3)

    // A splice would move every matrix after the hole — the whole cost the layer exists to
    // avoid. `n15` stood at x = 15; it now stands in the slot `n2` left.
    expect(cell.instanceMatrix.array[2 * 16 + 12]).toBe(WORTH_INSTANCING - 1)
  })

  it('keeps its slot for life, and pays nothing on the moves after the first', () => {
    const { scene, groups, objects, cell } = moving()
    shove(groups, objects, 'n2', 3)

    shove(groups, objects, 'n2', 7)
    shove(groups, objects, 'n2', 9)

    expect(cell.count).toBe(WORTH_INSTANCING - 1)
    expect(moverLot(scene)?.count).toBe(1)
    expect(moverLot(scene)?.instanceMatrix.array[13]).toBe(9)
  })

  it('is never culled, since a sphere measured once is wrong at its first step', () => {
    const { scene, groups, objects } = moving()

    shove(groups, objects, 'n2', 3)

    expect(moverLot(scene)?.frustumCulled).toBe(false)
  })

  it('stays off the grid when the content changes around it', () => {
    const { scene, groups, objects, nodes, cell } = moving()
    shove(groups, objects, 'n2', 3)

    groups.rebuild(nodes, id => objects.get(id))

    // A change of content must not put a mover back in a cell: that would rebuild the cell for
    // it, on every change, which is exactly what the layer exists to stop.
    expect(moverLot(scene)?.count).toBe(1)
    expect(groups.drawn()).toContain(cell)
  })

  it('leaves its lot when the document no longer holds it', () => {
    const { scene, groups, objects, nodes } = moving()
    shove(groups, objects, 'n2', 3)

    groups.rebuild(
      nodes.filter(node => node.id !== 'n2'),
      id => objects.get(id),
    )

    expect(moverLot(scene)?.count).toBe(0)
  })
})

describe('disposing the groups', () => {
  const settled = (): {
    scene: Object3D
    groups: ReturnType<typeof createCellGroups>
    objects: Map<string, Mesh>
  } => {
    const scene = host()
    const { nodes, objects } = bodies(inOneCell(WORTH_INSTANCING, 0))
    for (const mesh of objects.values()) scene.add(mesh)
    const groups = createCellGroups(scene)
    groups.rebuild(nodes, id => objects.get(id))
    return { scene, groups, objects }
  }

  it('takes its meshes out of the scene and gives the sources back to the walk', () => {
    const { scene, groups, objects } = settled()

    groups.dispose()

    expect(instancesIn(scene)).toHaveLength(0)
    expect(walked(scene)).toContain(objects.get('n0'))
  })

  it('takes the lots of the MOVERS with them, which no bucket names', () => {
    const { scene, groups, objects } = settled()
    const mover = objects.get('n2')
    if (!mover) throw new Error('no body to move')
    mover.position.set(0, 3, 0)
    mover.updateMatrixWorld(true)
    groups.moved(['n2'], id => objects.get(id))

    groups.dispose()

    // A lot of movers hangs from the host and belongs to no cell: a teardown that walked the
    // cells alone left its instance buffer on the GPU and its mesh in the scene.
    expect(instancesIn(scene)).toHaveLength(0)
  })
})
