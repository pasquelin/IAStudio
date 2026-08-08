import {
  BasicShadowMap,
  DirectionalLight,
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PointLight,
  AmbientLight,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { SHADOW_QUALITIES } from '@shared/domain/scene'
import { applyShadowFlags, applyShadowQuality, fitShadowCamera, resizeShadowMap } from './shadows'

/** Enough of a renderer for what this reads: jsdom has no WebGL to build a real one. */
function fakeRenderer() {
  return { shadowMap: { type: PCFShadowMap } }
}

describe('applyShadowQuality', () => {
  it('maps the studio words onto three.js map types', () => {
    const renderer = fakeRenderer()
    applyShadowQuality(renderer, 'hard')

    expect(renderer.shadowMap.type).toBe(BasicShadowMap)
  })

  // three.js 0.185 falls back to PCF from its deprecated softest filter: a third word here
  // would have been a setting that renders exactly like the second one.
  it('offers only the filters three.js actually applies', () => {
    expect(SHADOW_QUALITIES).toEqual(['hard', 'soft'])
  })

  it('maps soft onto the filter three.js keeps', () => {
    const renderer = fakeRenderer()
    applyShadowQuality(renderer, 'soft')

    expect(renderer.shadowMap.type).toBe(PCFShadowMap)
  })
})

describe('applyShadowFlags', () => {
  // A model is one node over a whole imported tree, and three.js reads the flags per mesh.
  it('reaches every mesh under the object, not only the object', () => {
    const root = new Object3D()
    const branch = new Object3D()
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    branch.add(mesh)
    root.add(branch)

    applyShadowFlags(root, true, false)

    expect(mesh.castShadow).toBe(true)
    expect(mesh.receiveShadow).toBe(false)
  })

  it('turns them back off, so unchecking the box actually reaches the tree', () => {
    const root = new Object3D()
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    root.add(mesh)

    applyShadowFlags(root, true, true)
    applyShadowFlags(root, false, false)

    expect(mesh.castShadow).toBe(false)
    expect(mesh.receiveShadow).toBe(false)
  })
})

describe('resizeShadowMap', () => {
  it('sizes the square map a light allocates', () => {
    const light = new DirectionalLight()
    resizeShadowMap(light, 1024)

    expect(light.shadow.mapSize.width).toBe(1024)
    expect(light.shadow.mapSize.height).toBe(1024)
  })

  // The map was allocated at the previous size: kept, three.js would draw into the old one.
  it('drops the map it had, so the new size is the one built', () => {
    const light = new PointLight()
    const map = { dispose: vi.fn(), setSize: vi.fn() }
    // A render target as three.js would have left one behind.
    Reflect.set(light.shadow, 'map', map)

    resizeShadowMap(light, 4096)

    expect(map.dispose).toHaveBeenCalled()
    expect(light.shadow.map).toBeNull()
  })

  it('does nothing when the size has not moved', () => {
    const light = new DirectionalLight()
    resizeShadowMap(light, 1024)
    const map = { dispose: vi.fn() }
    Reflect.set(light.shadow, 'map', map)

    resizeShadowMap(light, 1024)

    expect(map.dispose).not.toHaveBeenCalled()
  })

  // Ambient and hemisphere lights have no shadow to size, and neither has a plain object.
  it('leaves alone what casts nothing', () => {
    expect(() => resizeShadowMap(new AmbientLight(), 1024)).not.toThrow()
    expect(() => resizeShadowMap(new Object3D(), 1024)).not.toThrow()
  })
})

/**
 * A directional shadow frustum is a ten-unit box by default. On the twenty-metre grid the studio
 * lays a scene out against, half of it would throw nothing at all — with no hint as to why.
 */
describe('fitShadowCamera', () => {
  it('sizes the box against the grid the scene is built on', () => {
    const light = new DirectionalLight()
    fitShadowCamera(light, 20)

    expect(light.shadow.camera.right).toBe(10)
    expect(light.shadow.camera.left).toBe(-10)
    expect(light.shadow.camera.top).toBe(10)
    expect(light.shadow.camera.bottom).toBe(-10)
  })

  // three.js never reads a camera's own bounds back: the matrix has to be asked for.
  it('recomputes the projection, or the new size shows on nothing', () => {
    const light = new DirectionalLight()
    const update = vi.spyOn(light.shadow.camera, 'updateProjectionMatrix')

    fitShadowCamera(light, 40)

    expect(update).toHaveBeenCalled()
  })

  it('does nothing when the extent has not moved', () => {
    const light = new DirectionalLight()
    fitShadowCamera(light, 20)
    const update = vi.spyOn(light.shadow.camera, 'updateProjectionMatrix')

    fitShadowCamera(light, 20)

    expect(update).not.toHaveBeenCalled()
  })

  // A spot and a point shadow through a perspective camera, which has no box to size.
  it('leaves alone a shadow that is not cast through a box', () => {
    const spot = new PointLight()
    expect(() => fitShadowCamera(spot, 20)).not.toThrow()
    expect(() => fitShadowCamera(new AmbientLight(), 20)).not.toThrow()
  })
})
