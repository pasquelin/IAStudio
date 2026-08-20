import {
  AmbientLight,
  type BufferGeometry,
  CameraHelper,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PointLight,
  SpotLight,
  SpriteMaterial,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PATH, type PathDescriptor } from '@shared/domain/scene'
import { LIGHT_TYPES } from './lightTypes'
import { buildPath, geometryFor, PATH_CURVE_NAME, sizeKnobFor } from './threeFactory'
import { DEFAULT_MATERIAL } from './sceneState'
import {
  applyCamera,
  applyGeometry,
  applyLight,
  applyMaterial,
  applyPath,
  applySprite,
  giveSecondUvSet,
  showPathKnobs,
  standardMaterialOf,
  tiledGeometry,
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

    applyGeometry(mesh, { kind: 'sphere', radius: 2, widthSegments: 8, heightSegments: 6 }, 1)

    expect(mesh.geometry.type).toBe('SphereGeometry')
  })

  it('disposes the geometry it replaces', () => {
    const mesh = new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }))
    const dispose = vi.spyOn(mesh.geometry, 'dispose')

    applyGeometry(mesh, { kind: 'box', width: 2, height: 1, depth: 1 }, 1)

    expect(dispose).toHaveBeenCalled()
  })
})

/**
 * The maps repeat at a DENSITY, not a count: one number over UVs that run 0..1 whatever a face
 * measures gave a forty-metre band and the sixteen-metre one beside it two different textures,
 * which is what sent this batch back. The repeat rides on the UVs and not on the texture,
 * because the engine shares one `Texture` between every mesh asking for the same picture.
 */
describe('tiledGeometry', () => {
  const spanOf = (geometry: BufferGeometry): { u: number; v: number } => {
    const uv = geometry.attributes.uv
    if (!uv) return { u: Number.NaN, v: Number.NaN }

    const us: number[] = []
    const vs: number[] = []
    for (let at = 0; at < uv.count; at += 1) {
      us.push(uv.getX(at))
      vs.push(uv.getY(at))
    }
    return { u: Math.max(...us) - Math.min(...us), v: Math.max(...vs) - Math.min(...vs) }
  }

  it('puts one square per metre down each side of a face, however oblong', () => {
    const span = spanOf(tiledGeometry({ kind: 'plane', width: 40, height: 16 }, 1))

    expect(span.u).toBeCloseTo(40)
    expect(span.v).toBeCloseTo(16)
  })

  it('gives two faces of different shapes squares of the same size', () => {
    const wide = spanOf(tiledGeometry({ kind: 'plane', width: 40, height: 16 }, 1))
    const narrow = spanOf(tiledGeometry({ kind: 'plane', width: 16, height: 8 }, 1))

    expect(wide.u / 40).toBeCloseTo(narrow.u / 16)
    expect(wide.v / 16).toBeCloseTo(narrow.v / 8)
  })

  it('reads the density as squares per metre', () => {
    const span = spanOf(tiledGeometry({ kind: 'plane', width: 10, height: 10 }, 2.5))

    expect(span.u).toBeCloseTo(25)
  })

  /*
   * The density a picture is asked to FIT at — one over the metres it covers. Textures repeat, so
   * a projection centred on nothing puts 0,5 at the middle of the face: the left half of a plane
   * then shows the right half of the photograph, and no density anywhere makes it whole.
   */
  it('lays a picture down once, whole, at the density that covers the face', () => {
    const uv = tiledGeometry({ kind: 'plane', width: 4, height: 4 }, 0.25).attributes.uv
    const us: number[] = []
    for (let at = 0; at < (uv?.count ?? 0); at += 1) us.push(Number(uv?.getX(at)))

    expect(Math.min(...us)).toBeCloseTo(0)
    expect(Math.max(...us)).toBeCloseTo(1)
  })

  // A surface of revolution keeps its own UVs, scaled: projecting one would seam it all round.
  it('measures a cylinder round its side and down its height', () => {
    const span = spanOf(
      tiledGeometry(
        { kind: 'cylinder', radiusTop: 1, radiusBottom: 1, height: 4, segments: 24 },
        1,
      ),
    )

    expect(span.u).toBeCloseTo(2 * Math.PI)
    expect(span.v).toBeCloseTo(4)
  })

  // A tube's `v` runs ROUND it, not down a bounding box: measured off the box it came back as a
  // height, and the squares on the shipped tube were half the size asked for and not square.
  it('measures a tube round its own section', () => {
    const span = spanOf(
      tiledGeometry({ kind: 'tube', radius: 0.2, tubularSegments: 48, radialSegments: 12 }, 1),
    )

    expect(span.v).toBeCloseTo(2 * Math.PI * 0.2)
  })

  // The one that reaches the screen: a mesh built with a density, not only one edited into it.
  it('is what a mesh is born with, and what a change of density rebuilds', () => {
    const mesh = new Mesh(tiledGeometry({ kind: 'plane', width: 4, height: 4 }, 1))
    expect(spanOf(mesh.geometry).u).toBeCloseTo(4)

    applyGeometry(mesh, { kind: 'plane', width: 4, height: 4 }, 2)
    expect(spanOf(mesh.geometry).u).toBeCloseTo(8)
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

  /**
   * The outline is what makes a viewport with five cameras unreadable, and the camera it is
   * drawn from is the very one a preview and a film render through — so a shortened reach must
   * not survive the call.
   */
  it('draws a shortened outline without leaving the camera short', () => {
    const camera = cameraWithHelper()
    const helper = camera.children[0]
    if (!(helper instanceof CameraHelper)) throw new Error('the camera wears its helper')
    const seen: number[] = []
    vi.spyOn(helper, 'update').mockImplementation(() => void seen.push(camera.far))

    applyCamera(camera, { fov: 50, near: 0.1, far: 1000 }, 2)

    expect(seen).toEqual([2])
    expect(camera.far).toBe(1000)
  })

  it('never lengthens a frustum past the lens it belongs to', () => {
    const camera = cameraWithHelper()
    const helper = camera.children[0]
    if (!(helper instanceof CameraHelper)) throw new Error('the camera wears its helper')
    const seen: number[] = []
    vi.spyOn(helper, 'update').mockImplementation(() => void seen.push(camera.far))

    applyCamera(camera, { fov: 50, near: 0.1, far: 5 }, 40)

    expect(seen).toEqual([5])
  })
})

describe('showPathKnobs', () => {
  /**
   * Only a selected rail hands its points to the gizmo, and a knob per point on every rail is
   * what buries a sequence. The line stays, so an unselected rail can still be clicked.
   */
  it('hides the knobs and leaves the line', () => {
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ]
    const object = buildPath({ ...DEFAULT_PATH, points }, '#ffffff')

    showPathKnobs(object, false)
    expect(
      object.children.filter(child => child instanceof Mesh).map(knob => knob.visible),
    ).toEqual([false, false])
    expect(object.getObjectByName(PATH_CURVE_NAME)?.visible).toBe(true)

    showPathKnobs(object, true)
    expect(
      object.children.filter(child => child instanceof Mesh).map(knob => knob.visible),
    ).toEqual([true, true])
  })
})

describe('a knob about to be drawn', () => {
  const pathOf = (points: PathDescriptor['points']): PathDescriptor => ({
    ...DEFAULT_PATH,
    points,
  })

  /** What the knob's own `onBeforeRender` calls, with the camera about to draw it. */
  const draw = (knob: Object3D, camera: PerspectiveCamera): void => {
    knob.parent?.updateMatrixWorld(true)
    sizeKnobFor(knob, camera)
  }

  const cameraAt = (z: number): PerspectiveCamera => {
    const camera = new PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.set(0, 0, z)
    return camera
  }

  /**
   * A knob of a fixed size in the SCENE covers five pixels once the view steps back, and a
   * target of five pixels is one nobody hits.
   */
  it('grows with the distance of the camera drawing it, keeping its size on screen', () => {
    const object = buildPath(
      pathOf([
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
      ]),
      '#ffffff',
    )
    const knob = object.children[1]
    if (!knob) throw new Error('the rail was built without a knob')

    draw(knob, cameraAt(5))
    const near = knob.scale.x

    draw(knob, cameraAt(10))

    expect(knob.scale.x).toBeCloseTo(near * 2, 3)
  })

  // Written into the matrix on the spot: a scale three has already composed for this draw shows
  // up one frame late, which reads as a lag.
  it('carries the size it just took into the matrix it is drawn with', () => {
    const object = buildPath(
      pathOf([
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
      ]),
      '#ffffff',
    )
    const knob = object.children[1]
    if (!knob) throw new Error('the rail was built without a knob')

    draw(knob, cameraAt(20))

    expect(knob.matrixWorld.elements[0]).toBeCloseTo(knob.scale.x, 5)
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

    applyGeometry(mesh, { kind: 'sphere', radius: 2, widthSegments: 8, heightSegments: 6 }, 1)

    expect(mesh.geometry.attributes.uv1).toBeDefined()
  })

  it('does not invent one for a shape that never had it', () => {
    const mesh = new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }))

    applyGeometry(mesh, { kind: 'sphere', radius: 2, widthSegments: 8, heightSegments: 6 }, 1)

    expect(mesh.geometry.attributes.uv1).toBeUndefined()
  })
})
