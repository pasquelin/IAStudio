import { describe, expect, it } from 'vitest'
import { Mesh, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, Texture } from 'three'
import type { Object3D } from 'three'
import { createTestObjects, type TestObjects } from './testObjects'

type Ground = Mesh<PlaneGeometry, MeshStandardMaterial>

const isGround = (child: Object3D): child is Ground =>
  child instanceof Mesh &&
  child.geometry instanceof PlaneGeometry &&
  child.material instanceof MeshStandardMaterial

const groundOf = ({ group }: TestObjects): Ground => {
  const ground = group.children.find(isGround)
  if (!ground) throw new Error('the probes have no ground')
  return ground
}

describe('what the probes show', () => {
  /**
   * The claim is one tile per metre, so the count is read off the PLANE — against the constant
   * that wrote it, a floor resized to ten metres would keep its forty tiles and stay green.
   */
  it('lays the ground map out one tile per metre, tiled rather than stretched', () => {
    const probes = createTestObjects()
    const map = new Texture()
    const ground = groundOf(probes)
    const bare = ground.material.version

    probes.setGroundMap(map)

    expect(ground.material.map).toBe(map)
    expect([map.repeat.x, map.repeat.y]).toEqual([
      ground.geometry.parameters.width,
      ground.geometry.parameters.height,
    ])
    expect([map.wrapS, map.wrapT]).toEqual([RepeatWrapping, RepeatWrapping])
    // Gaining a map is another shader: without the version moving, the floor stays plain white.
    expect(ground.material.version).toBeGreaterThan(bare)

    probes.dispose()
  })

  // Freed by whoever loaded it. Disposing it here would leave that holder pointing at a texture
  // the GPU no longer has.
  it('gives the map back untouched when the probes go', () => {
    const probes = createTestObjects()
    const map = new Texture()
    let freed = false
    map.addEventListener('dispose', () => {
      freed = true
    })

    probes.setGroundMap(map)
    probes.dispose()

    expect(freed).toBe(false)
  })
})
