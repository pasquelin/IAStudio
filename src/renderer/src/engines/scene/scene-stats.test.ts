import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry, Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { densityOf, EMPTY_STATS, statsOf, totalStats } from './scene-stats'

function texturedMaterial(width: number, height: number): MeshStandardMaterial {
  const material = new MeshStandardMaterial()
  const texture = new Texture()
  // jsdom decodes no image; what the count reads is the size, which a plain object carries.
  texture.image = { width, height }
  material.map = texture
  return material
}

describe('statsOf', () => {
  it('counts a cube through its index rather than its positions', () => {
    const cube = new Mesh(new BoxGeometry(), new MeshStandardMaterial())

    const stats = statsOf([cube])

    // A box is 24 vertices and 36 indices: 12 triangles, two per face.
    expect(stats.triangles).toBe(12)
    expect(stats.vertices).toBe(24)
    expect(stats.draws).toBe(1)
  })

  it('counts a shared geometry once, and each mesh that draws it as its own call', () => {
    const geometry = new BoxGeometry()
    const first = new Mesh(geometry, new MeshStandardMaterial())
    const second = new Mesh(geometry, new MeshStandardMaterial())

    const stats = statsOf([first, second])

    expect(stats.triangles).toBe(12)
    expect(stats.draws).toBe(2)
  })

  it('counts a shared texture once', () => {
    const material = texturedMaterial(256, 256)
    const first = new Mesh(new BoxGeometry(), material)
    const second = new Mesh(new PlaneGeometry(), material)

    expect(statsOf([first, second]).textureBytes).toBe(256 * 256 * 4)
  })

  it('leaves out what is hidden', () => {
    const cube = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    cube.visible = false

    expect(statsOf([cube])).toEqual(EMPTY_STATS)
  })

  it('walks children, since a model arrives as a tree', () => {
    const root = new Object3D()
    root.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))
    root.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))

    expect(statsOf([root]).draws).toBe(2)
  })

  it('skips what a caller has already counted elsewhere', () => {
    const geometry = new BoxGeometry()
    const seen = { geometries: new Set<unknown>([geometry]), textures: new Set<unknown>() }

    const stats = statsOf([new Mesh(geometry, new MeshStandardMaterial())], seen)

    // The draw still counts — it is a second call — but the buffer is not counted twice.
    expect(stats.triangles).toBe(0)
    expect(stats.draws).toBe(1)
  })

  it('counts nothing for a texture whose image never landed', () => {
    const material = new MeshStandardMaterial()
    material.map = new Texture()

    expect(statsOf([new Mesh(new BoxGeometry(), material)]).textureBytes).toBe(0)
  })
})

describe('densityOf', () => {
  it('reads a small crowded object as denser than a large plain one', () => {
    const small = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshStandardMaterial())
    const large = new Mesh(new BoxGeometry(10, 10, 10), new MeshStandardMaterial())

    expect(densityOf(small)).toBeGreaterThan(densityOf(large))
  })

  it('answers zero for something that carries no triangle at all', () => {
    expect(densityOf(new Object3D())).toBe(0)
  })

  it('gives a flat surface its triangles rather than a division by zero', () => {
    const plane = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial())
    plane.scale.set(1, 1, 0)

    expect(Number.isFinite(densityOf(plane))).toBe(true)
    expect(densityOf(plane)).toBeGreaterThan(0)
  })
})

describe('totalStats', () => {
  it('adds up what each part holds', () => {
    const total = totalStats([
      { triangles: 12, vertices: 24, draws: 1, textureBytes: 100 },
      { triangles: 2, vertices: 4, draws: 1, textureBytes: 0 },
    ])

    expect(total).toEqual({ triangles: 14, vertices: 28, draws: 2, textureBytes: 100 })
  })

  it('adds up nothing to nothing', () => {
    expect(totalStats([])).toEqual(EMPTY_STATS)
  })
})
