import {
  AmbientLight,
  type BufferGeometry,
  CameraHelper,
  DirectionalLight,
  HemisphereLight,
  Line,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PointLight,
  SpotLight,
  SpriteMaterial,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { bezierPathOf, DEFAULT_PATH, type PathDescriptor } from '@shared/domain/scene'
import { LIGHT_TYPES } from './lightTypes'
import {
  buildPath,
  dressWithRail,
  geometryFor,
  barName,
  handleName,
  handlePartOf,
  knobIndexOf,
  knobName,
  PATH_CURVE_NAME,
  PATH_KNOB_PREFIX,
  sizeKnobFor,
} from './threeFactory'
import { DEFAULT_MATERIAL } from './sceneState'
import {
  applyCamera,
  wearGeometry,
  applyLight,
  applyMaterial,
  applyNegative,
  unmarkTools,
  applyPath,
  applySprite,
  giveSecondUvSet,
  showPathHandles,
  showPathKnobs,
  standardMaterialOf,
  tiledGeometry,
} from './threeSync'

describe('applyNegative', () => {
  const painted = (negative: boolean): MeshStandardMaterial => {
    const material = new MeshStandardMaterial()
    applyMaterial(material, { ...DEFAULT_MATERIAL, color: '#00ff00' }, '')
    applyNegative(material, '#ff715b', negative)
    return material
  }

  /** Roblox's look for a tool: seen through, and not wearing the paint it will be cut with. */
  it('shows a marked shape red and translucent', () => {
    const material = painted(true)

    expect(material.color.getHexString()).toBe('ff715b')
    expect(material.transparent).toBe(true)
    expect(material.opacity).toBeLessThan(1)
  })

  // Or a tool standing in front of the matter would hide it rather than show through it.
  it('lets a marked shape be seen through by whatever stands behind it', () => {
    expect(painted(true).depthWrite).toBe(false)
  })

  /** Taking the mark off has to give the shape its own paint back, opaque, in the same pass. */
  it('leaves an unmarked shape exactly as its descriptor asked', () => {
    const material = painted(false)

    expect(material.color.getHexString()).toBe('00ff00')
    expect(material.transparent).toBe(false)
    expect(material.opacity).toBe(1)
    expect(material.depthWrite).toBe(true)
  })
})

describe('unmarkTools', () => {
  /**
   * The export SHARES its materials — `placedCopy` says so — so a mark left on one shipped a red,
   * 45 %-opaque cube into every `.glb`. A mark is an editing role, not a finish.
   */
  it('gives an exported copy back the paint the mark was covering', () => {
    const material = new MeshStandardMaterial()
    applyMaterial(material, { ...DEFAULT_MATERIAL, color: '#00ff00' }, '')
    applyNegative(material, '#ff715b', true)
    const mesh = new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }), material)

    unmarkTools(mesh)
    const worn = standardMaterialOf(mesh)

    expect(worn?.color.getHexString()).toBe('00ff00')
    expect(worn?.transparent).toBe(false)
    expect(worn?.opacity).toBe(1)
    // The one on screen keeps its mark: the copy is what travels, and the viewport is not it.
    expect(material.color.getHexString()).toBe('ff715b')
  })

  it('leaves a shape that carries no mark exactly as it was', () => {
    const material = new MeshStandardMaterial()
    applyMaterial(material, { ...DEFAULT_MATERIAL, color: '#00ff00' }, '')
    const mesh = new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }), material)

    unmarkTools(mesh)
    expect(mesh.material).toBe(material)
  })
})

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

describe('wearGeometry', () => {
  const box = (width: number): BufferGeometry =>
    geometryFor({ kind: 'box', width, height: 1, depth: 1 })

  it('puts the mesh on the shape it is given', () => {
    const mesh = new Mesh(box(1))
    const next = box(2)

    wearGeometry(mesh, next)

    expect(mesh.geometry).toBe(next)
  })

  it('hands back the shape it took off, rather than disposing it', () => {
    const worn = box(1)
    const mesh = new Mesh(worn)
    const dispose = vi.spyOn(worn, 'dispose')

    // The caller frees it: only it knows which cache lent it, and disposing one the cache still
    // lends empties every other node of that shape.
    expect(wearGeometry(mesh, box(2))).toBe(worn)
    expect(dispose).not.toHaveBeenCalled()
  })

  it('says nothing was taken off when the mesh already wore that shape', () => {
    const worn = box(1)

    expect(wearGeometry(new Mesh(worn), worn)).toBeNull()
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

    wearGeometry(mesh, tiledGeometry({ kind: 'plane', width: 4, height: 4 }, 2))
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

describe('dressWithRail', () => {
  const rail = {
    ...DEFAULT_PATH,
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ],
  }

  /** A band wears the handles of the rail it is swept along — the mesh itself carries them. */
  it('hangs a line and a knob per point on whatever carries the rail', () => {
    const mesh = dressWithRail(new Mesh(), rail, { knob: '#ffffff' }, true)
    const knobs = mesh.children.filter(child => child.name.startsWith(PATH_KNOB_PREFIX))

    expect(knobs).toHaveLength(3)
    expect(mesh.getObjectByName(PATH_CURVE_NAME)).toBeDefined()
  })

  /**
   * 🛑 Drawn THROUGH the matter for a BAND: a rail hangs in the air, but a band's run lies inside
   * the very surface it shapes — its handles were behind it, and one cannot grab those.
   */
  it('draws a banded rail in front of every surface, and a bare one in its place', () => {
    const depthOf = (object: Object3D | undefined): boolean =>
      object instanceof Mesh && object.material instanceof MeshBasicMaterial
        ? object.material.depthTest
        : true
    const knobOf = (through: boolean): Object3D | undefined =>
      dressWithRail(new Mesh(), rail, { knob: '#ffffff' }, through).children.find(child =>
        child.name.startsWith(PATH_KNOB_PREFIX),
      )

    expect(depthOf(knobOf(true))).toBe(false)
    expect(knobOf(true)?.renderOrder).toBeGreaterThan(0)
    // A rail of its own hangs in the air: seen through everything it would cross the whole set.
    expect(depthOf(knobOf(false))).toBe(true)
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
      object.children.filter(child => knobIndexOf(child.name) !== null).map(knob => knob.visible),
    ).toEqual([false, false])
    expect(object.getObjectByName(PATH_CURVE_NAME)?.visible).toBe(true)

    showPathKnobs(object, true)
    expect(
      object.children.filter(child => knobIndexOf(child.name) !== null).map(knob => knob.visible),
    ).toEqual([true, true])
  })
})

describe('showPathHandles', () => {
  const rail = bezierPathOf(
    [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 0, z: 10 },
    ],
    false,
  )

  /**
   * 🛑 The pair of the anchor being worked on, and of no other: twenty-four anchors showing their
   * tangents at once is a run nobody can read, and Photoshop shows the one clicked.
   */
  it('shows the tangents of one anchor and hides every other', () => {
    const object = buildPath(rail, '#ffffff')

    showPathHandles(object, 1)
    const shown = object.children.filter(child => child.visible && handlePartOf(child.name))

    expect(shown.map(child => child.name).sort()).toEqual([
      handleName('in', 1),
      handleName('out', 1),
    ])
  })

  /**
   * 🛑 A COLOUR OF ITS OWN, handed in: the anchors wear the mesh token and the tangents another,
   * two things one drags for different reasons not reading as one. Written here as a hex, it
   * would be the one surface of the studio that never follows its palette.
   */
  it('paints the tangents in the colour it is handed, apart from the anchors', () => {
    const object = dressWithRail(
      new Mesh(),
      rail,
      { knob: '#111111', handle: '#e0a350', start: '#3d7ab8' },
      false,
    )
    const colourOf = (name: string): string => {
      const child = object.getObjectByName(name)
      return child instanceof Mesh && child.material instanceof MeshBasicMaterial
        ? `#${child.material.color.getHexString()}`
        : ''
    }

    expect(colourOf(handleName('out', 1))).toBe('#e0a350')
    expect(colourOf(knobName(1))).toBe('#111111')
    // 🛑 And the FIRST anchor apart from the rest: a run of identical dots says nothing about
    // which end it starts from, and a band swept along it has a direction to read.
    expect(colourOf(knobName(0))).toBe('#3d7ab8')
  })

  /** The bar is what makes a tangent readable as a lever: without it, a lone dot in a field. */
  it('ties each tangent to its anchor with a bar', () => {
    const object = buildPath(rail, '#ffffff')
    const bar = object.getObjectByName(barName('out', 1))
    const drawn = bar instanceof Line ? bar.geometry.getAttribute('position') : null

    expect(drawn?.count).toBe(2)
    expect(drawn?.getX(0)).toBeCloseTo(rail.points[1]!.x, 6)
  })

  it('hides them all when no anchor is held', () => {
    const object = buildPath(rail, '#ffffff')

    showPathHandles(object, 1)
    showPathHandles(object, null)

    expect(object.children.filter(child => child.visible && handlePartOf(child.name))).toEqual([])
  })

  /**
   * 🛑 Placed by the BUILD, not only by a later sync: left to the sync, every tangent sat at the
   * rail's own origin until something else changed the shape — a green dot in the middle of a
   * field, and no bar anywhere.
   */
  it('stands each tangent off its own anchor from the moment it is built', () => {
    const object = buildPath(rail, '#ffffff')
    const anchor = rail.points[1]!
    const out = object.getObjectByName(handleName('out', 1))
    const reach = rail.kind === 'bezier' ? rail.handles[1]!.out : { x: 0, y: 0, z: 0 }

    expect(out?.position.x).toBeCloseTo(anchor.x + reach.x, 6)
    expect(out?.position.z).toBeCloseTo(anchor.z + reach.z, 6)
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

    expect(object.children.filter(child => knobIndexOf(child.name) !== null)).toHaveLength(2)
    expect(object.getObjectByName(PATH_CURVE_NAME)).toBeDefined()
  })

  it('follows a point that moved without building a knob for it', () => {
    const object = buildPath(pathOf([at(0), at(10)]), '#ffffff')
    // By NAME rather than by position: an anchor carries its two tangents and their bars, so what
    // stands where among the children is not what this is about.
    const knob = object.getObjectByName(knobName(1))

    applyPath(object, pathOf([at(0), at(4)]), '#ffffff')

    expect(object.getObjectByName(knobName(1))).toBe(knob)
    expect(knob?.position.x).toBe(4)
  })

  it('grows a knob for a point added, and drops the one a point taken away had', () => {
    const object = buildPath(pathOf([at(0), at(10)]), '#ffffff')

    applyPath(object, pathOf([at(0), at(5), at(10)]), '#ffffff')
    expect(object.children.filter(child => knobIndexOf(child.name) !== null)).toHaveLength(3)

    applyPath(object, pathOf([at(0), at(10)]), '#ffffff')
    expect(object.children.filter(child => knobIndexOf(child.name) !== null)).toHaveLength(2)
  })
})

// An occlusion map reads the second UV set; without this, nudging a radius would stop it dead.
describe('wearGeometry and the second UV set', () => {
  it('carries it over to the shape that replaces the one that had it', () => {
    const mesh = new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }))
    giveSecondUvSet(mesh.geometry)

    wearGeometry(
      mesh,
      geometryFor({ kind: 'sphere', radius: 2, widthSegments: 8, heightSegments: 6 }),
    )

    expect(mesh.geometry.attributes.uv1).toBeDefined()
  })

  it('does not invent one for a shape that never had it', () => {
    const mesh = new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }))

    wearGeometry(
      mesh,
      geometryFor({ kind: 'sphere', radius: 2, widthSegments: 8, heightSegments: 6 }),
    )

    expect(mesh.geometry.attributes.uv1).toBeUndefined()
  })
})
