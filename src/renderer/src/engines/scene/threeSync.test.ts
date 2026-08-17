import {
  AmbientLight,
  CameraHelper,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  SpotLight,
  SpriteMaterial,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PATH, type PathDescriptor } from '@shared/domain/scene'
import { LIGHT_TYPES } from './lightTypes'
import { buildPath, geometryFor, PATH_CURVE_NAME } from './threeFactory'
import { DEFAULT_MATERIAL } from './sceneState'
import {
  applyCamera,
  applyGeometry,
  applyLight,
  applyMaterial,
  applyPath,
  applySprite,
  giveSecondUvSet,
  standardMaterialOf,
} from './threeSync'

describe('applyMaterial', () => {
  it('writes the descriptor into the material it was given', () => {
    const material = new MeshStandardMaterial()

    applyMaterial(
      material,
      { ...DEFAULT_MATERIAL, color: '#ff0000', roughness: 0.25, metalness: 0.5 },
      '',
    )

    expect(material.color.getHexString()).toBe('ff0000')
    expect(material.roughness).toBe(0.25)
    expect(material.metalness).toBe(0.5)
  })

  // Replacing it would compile a shader program per pointer move of a roughness slider.
  it('keeps the same material instance', () => {
    const material = new MeshStandardMaterial()
    const mesh = new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }), material)

    applyMaterial(material, DEFAULT_MATERIAL, '#868a91')

    expect(mesh.material).toBe(material)
  })

  it('falls back to the studio colour when the descriptor carries none', () => {
    const material = new MeshStandardMaterial()

    applyMaterial(material, DEFAULT_MATERIAL, '#868a91')

    expect(material.color.getHexString()).toBe('868a91')
  })

  // The palette is only readable once a canvas is in the document, so it can legitimately be
  // empty — and `Color.set('')` throws.
  it('leaves the colour alone when neither the descriptor nor the palette has one', () => {
    const material = new MeshStandardMaterial()
    material.color.set('#123456')

    applyMaterial(material, DEFAULT_MATERIAL, '')

    expect(material.color.getHexString()).toBe('123456')
  })
})

describe('applySprite', () => {
  const sprite = { color: '#ff0000', opacity: 1, map: null }

  it('writes the descriptor into the material it was given', () => {
    const material = new SpriteMaterial()

    applySprite(material, sprite, '#123456')

    expect(material.color.getHexString()).toBe('ff0000')
    expect(material.opacity).toBe(1)
  })

  it('falls back to the studio colour when the descriptor carries none', () => {
    const material = new SpriteMaterial()

    applySprite(material, { ...sprite, color: null }, '#00ff00')

    expect(material.color.getHexString()).toBe('00ff00')
  })

  it('fades the sprite', () => {
    const material = new SpriteMaterial()

    applySprite(material, { ...sprite, opacity: 0.5 }, '#123456')

    expect(material.opacity).toBe(0.5)
  })

  // Switched off at full opacity, every picture with an alpha channel would draw its whole quad.
  it('leaves the material transparent, whatever the opacity says', () => {
    const material = new SpriteMaterial()

    applySprite(material, sprite, '#123456')

    expect(material.transparent).toBe(true)
  })
})

describe('applyGeometry', () => {
  it('swaps in the geometry the descriptor asks for', () => {
    const mesh = new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }))

    applyGeometry(mesh, { kind: 'sphere', radius: 2, widthSegments: 8, heightSegments: 6 })

    expect(mesh.geometry.type).toBe('SphereGeometry')
  })

  it('disposes the geometry it replaces', () => {
    const mesh = new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }))
    const dispose = vi.spyOn(mesh.geometry, 'dispose')

    applyGeometry(mesh, { kind: 'box', width: 2, height: 1, depth: 1 })

    expect(dispose).toHaveBeenCalled()
  })
})

describe('applyLight', () => {
  it('writes colour and intensity on an ambient light', () => {
    const light = new AmbientLight()

    applyLight(light, { kind: 'ambient', color: '#00ff00', intensity: 0.4 })

    expect(light.color.getHexString()).toBe('00ff00')
    expect(light.intensity).toBe(0.4)
  })

  it('moves the target of a directional light', () => {
    const light = new DirectionalLight()

    applyLight(light, {
      kind: 'directional',
      color: '#ffffff',
      intensity: 2,
      target: { x: 1, y: -2, z: 3 },
    })

    expect(light.target.position.toArray()).toEqual([1, -2, 3])
  })

  it('writes both halves of a hemisphere light', () => {
    const light = new HemisphereLight()

    applyLight(light, {
      kind: 'hemisphere',
      skyColor: '#00aaff',
      groundColor: '#ffaa00',
      intensity: 0.5,
    })

    expect(light.color.getHexString()).toBe('00aaff')
    expect(light.groundColor.getHexString()).toBe('ffaa00')
  })

  it('writes the falloff of a point light', () => {
    const light = new PointLight()

    applyLight(light, { kind: 'point', color: '#ffffff', intensity: 1, distance: 12, decay: 1.5 })

    expect(light.distance).toBe(12)
    expect(light.decay).toBe(1.5)
  })

  it('writes the cone of a spot light', () => {
    const light = new SpotLight()

    applyLight(light, {
      kind: 'spot',
      color: '#ffffff',
      intensity: 1,
      distance: 8,
      angle: 0.5,
      penumbra: 0.3,
      decay: 2,
      target: { x: 0, y: -1, z: 0 },
    })

    expect(light.angle).toBe(0.5)
    expect(light.penumbra).toBe(0.3)
    expect(light.target.position.y).toBe(-1)
  })

  // The helper draws from the target's world matrix, which nothing else refreshes before the
  // frame that follows the edit.
  it('refreshes the world matrix of the target it moved', () => {
    const light = new SpotLight()

    applyLight(light, {
      kind: 'spot',
      color: '#ffffff',
      intensity: 1,
      distance: 0,
      angle: 0.1,
      penumbra: 0,
      decay: 2,
      target: { x: 4, y: 0, z: 0 },
    })

    expect(light.target.matrixWorld.elements[12]).toBe(4)
  })

  it('leaves a light alone when the descriptor is for another kind', () => {
    const light = new AmbientLight()

    applyLight(light, { kind: 'point', color: '#ffffff', intensity: 3, distance: 5, decay: 1 })

    expect(light.intensity).toBe(3)
    expect('distance' in light).toBe(false)
  })
})

describe('standardMaterialOf', () => {
  it('hands back the material a mesh was built with', () => {
    const material = new MeshStandardMaterial()
    const mesh = new Mesh(undefined, material)

    expect(standardMaterialOf(mesh)).toBe(material)
  })

  it('refuses an array of materials', () => {
    const mesh = new Mesh(undefined, [new MeshStandardMaterial()])

    expect(standardMaterialOf(mesh)).toBeNull()
  })
})

/**
 * Each branch checks the class it writes to rather than casting. A descriptor that does not
 * match the light it is handed leaves it alone: three.js throws on a field its class has no
 * room for, and a mismatched pair is reachable while a kind is being swapped.
 */
describe('a light descriptor handed to a light of another class', () => {
  // Read off the registry rather than typed out: a sixth kind of light is then covered the day
  // it lands, instead of quietly not being.
  const positioned = LIGHT_TYPES.filter(type => type.kind !== 'ambient')

  for (const type of positioned) {
    it(`leaves an ambient light alone when given a ${type.kind} descriptor`, () => {
      const light = new AmbientLight()
      const descriptor = type.create()

      expect(() => applyLight(light, descriptor)).not.toThrow()
      expect(light.intensity).toBe(descriptor.intensity)
    })
  }
})

describe('applyCamera', () => {
  const cameraWithHelper = (): PerspectiveCamera => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 1000)
    camera.add(new CameraHelper(camera))
    return camera
  }

  it('writes the lens and rebuilds the projection', () => {
    const camera = cameraWithHelper()

    applyCamera(camera, { fov: 90, near: 1, far: 10 })

    expect([camera.fov, camera.near, camera.far]).toEqual([90, 1, 10])
  })

  // The helper reads the projection matrix once: left alone it keeps outlining the old frustum.
  it('updates the frustum drawn from it', () => {
    const camera = cameraWithHelper()
    const helper = camera.children[0]
    if (!(helper instanceof CameraHelper)) throw new Error('the camera wears its helper')
    const update = vi.spyOn(helper, 'update')

    applyCamera(camera, { fov: 90, near: 1, far: 10 })

    expect(update).toHaveBeenCalled()
  })
})

describe('applyPath', () => {
  const pathOf = (points: PathDescriptor['points']): PathDescriptor => ({
    ...DEFAULT_PATH,
    points,
  })
  const at = (x: number) => ({ x, y: 0, z: 0 })

  it('draws the line and one knob per control point', () => {
    const object = buildPath(pathOf([at(0), at(10)]), '#ffffff')

    expect(object.children.filter(child => child instanceof Mesh)).toHaveLength(2)
    expect(object.getObjectByName(PATH_CURVE_NAME)).toBeDefined()
  })

  it('follows a point that moved without building a knob for it', () => {
    const object = buildPath(pathOf([at(0), at(10)]), '#ffffff')
    // Child 0 is the line, so the knob of the point that moves is the second one after it.
    const knob = object.children[2]

    applyPath(object, pathOf([at(0), at(4)]), '#ffffff')

    expect(object.children[2]).toBe(knob)
    expect(knob?.position.x).toBe(4)
  })

  it('grows a knob for a point added, and drops the one a point taken away had', () => {
    const object = buildPath(pathOf([at(0), at(10)]), '#ffffff')

    applyPath(object, pathOf([at(0), at(5), at(10)]), '#ffffff')
    expect(object.children.filter(child => child instanceof Mesh)).toHaveLength(3)

    applyPath(object, pathOf([at(0), at(10)]), '#ffffff')
    expect(object.children.filter(child => child instanceof Mesh)).toHaveLength(2)
  })
})

// An occlusion map reads the second UV set; without this, nudging a radius would stop it dead.
describe('applyGeometry and the second UV set', () => {
  it('carries it over to the shape that replaces the one that had it', () => {
    const mesh = new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }))
    giveSecondUvSet(mesh.geometry)

    applyGeometry(mesh, { kind: 'sphere', radius: 2, widthSegments: 8, heightSegments: 6 })

    expect(mesh.geometry.attributes.uv1).toBeDefined()
  })

  it('does not invent one for a shape that never had it', () => {
    const mesh = new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }))

    applyGeometry(mesh, { kind: 'sphere', radius: 2, widthSegments: 8, heightSegments: 6 })

    expect(mesh.geometry.attributes.uv1).toBeUndefined()
  })
})
