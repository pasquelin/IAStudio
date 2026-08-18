import { DirectionalLight, Quaternion, Vector3, type Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { anglesFromDirection, directionFromAngles, toRadians } from '@shared/domain/angles'
import { directionOfQuaternion, GLTF_STUDIO_KEY, KHR_LIGHTS_PUNCTUAL } from '@shared/domain/gltf'
import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import { isRecord } from '@shared/guards'
import { gltfSkyOf, skyFromGltf } from './gltfSky'

const sky = (over: Partial<SkyboxContent> = {}): SkyboxContent => ({
  ...createSkyboxContent(),
  source: { assetId: 'asset-dusk' },
  sun: { elevation: toRadians(35), azimuth: toRadians(120), intensity: 2.5, color: '#ffcc66' },
  ...over,
})

const written = (
  content: SkyboxContent,
  sourceUri: string | null = '../Assets/dusk.hdr',
): unknown => JSON.parse(JSON.stringify(gltfSkyOf(content, { name: 'Crépuscule', sourceUri })))

/** The file with the studio's own half taken out — what another application is left holding. */
function foreign(payload: unknown): unknown {
  if (!isRecord(payload)) return payload
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'extras'))
}

const nodeNamed = (payload: unknown, name: string): Record<string, unknown> | undefined => {
  const nodes = isRecord(payload) && Array.isArray(payload.nodes) ? payload.nodes : []
  return nodes.filter(isRecord).find(node => node.name === name)
}

describe('a sky written as glTF', () => {
  it('declares the extension it uses and hangs the sun off a light', () => {
    const file = written(sky())

    expect(file).toMatchObject({
      asset: { version: '2.0' },
      extensionsUsed: [KHR_LIGHTS_PUNCTUAL],
      scene: 0,
    })
    expect(nodeNamed(file, 'Sun')?.extensions).toEqual({ [KHR_LIGHTS_PUNCTUAL]: { light: 0 } })
  })

  /**
   * A directional light of `KHR_lights_punctual` travels down its node's `-Z`, so the node's `+Z`
   * is where the sun STANDS. Checked as a direction rather than as four numbers: a quaternion has
   * two spellings for one rotation, and asserting the digits would pin the wrong thing.
   */
  it('aims the sun node where the angles say the sun stands', () => {
    const content = sky()
    const rotation = nodeNamed(written(content), 'Sun')?.rotation

    expect(Array.isArray(rotation)).toBe(true)
    const aimed = directionOfQuaternion(Array.isArray(rotation) ? rotation : [])
    const expected = directionFromAngles(content.sun)

    expect(aimed.x).toBeCloseTo(expected.x, 6)
    expect(aimed.y).toBeCloseTo(expected.y, 6)
    expect(aimed.z).toBeCloseTo(expected.z, 6)
  })

  /** The one direction whose cross product with `+Z` is the zero vector — due south, at the horizon. */
  it('aims a sun that stands exactly opposite the reference axis', () => {
    const content = sky({ sun: { elevation: 0, azimuth: Math.PI, intensity: 1, color: '#ffffff' } })
    const rotation = nodeNamed(written(content), 'Sun')?.rotation
    const aimed = directionOfQuaternion(Array.isArray(rotation) ? rotation : [])

    expect(aimed.z).toBeCloseTo(-1, 6)
    expect(Math.hypot(aimed.x, aimed.y)).toBeCloseTo(0, 6)
  })

  it('turns the horizon by a node rotation rather than by a field of its own', () => {
    const file = written(
      sky({ adjustments: { ...createSkyboxContent().adjustments, rotationY: 1 } }),
    )

    expect(nodeNamed(file, 'Horizon')?.rotation).toEqual([0, Math.sin(0.5), 0, Math.cos(0.5)])
  })

  /**
   * The picture stays a `.hdr` beside the document, named by a PATH: an asset id resolves to
   * nothing outside this studio, and to nothing at all in another project.
   */
  it('points at the source picture rather than embedding or naming it by id', () => {
    expect(written(sky())).toMatchObject({ images: [{ uri: '../Assets/dusk.hdr' }] })
  })

  it('writes no image at all for a sky that has no picture yet', () => {
    expect(written(sky({ source: null }), null)).not.toHaveProperty('images')
  })

  it('carries the whole studio state where glTF reserves room for it', () => {
    const content = sky()

    expect(written(content)).toMatchObject({ extras: { [GLTF_STUDIO_KEY]: content } })
  })
})

describe('a sky read back', () => {
  it('gives back what it was handed', () => {
    const content = sky()

    expect(skyFromGltf(written(content), () => '')).toEqual(content)
  })

  /** A document copied into another project keeps an id that names nothing: the path is what says. */
  it('relinks the picture by its path when the id names nothing here', () => {
    const content = sky({ source: null })

    expect(skyFromGltf(written(content), uri => (uri ? 'asset-relinked' : ''))).toMatchObject({
      source: { assetId: 'asset-relinked' },
    })
  })
})

describe('a sky written by another application', () => {
  const rebuilt = (content: SkyboxContent): SkyboxContent =>
    skyFromGltf(foreign(written(content)), () => 'asset-found')

  it('takes the sun back off the light and the node that aims it', () => {
    const content = sky()
    const read = rebuilt(content)

    expect(read.sun.intensity).toBeCloseTo(content.sun.intensity, 6)
    expect(read.sun.color).toBe(content.sun.color)
    expect(read.sun.elevation).toBeCloseTo(content.sun.elevation, 6)
    expect(read.sun.azimuth).toBeCloseTo(content.sun.azimuth, 6)
  })

  it('takes the horizon back off the node that turns it', () => {
    const content = sky({ adjustments: { ...createSkyboxContent().adjustments, rotationY: 2 } })

    expect(rebuilt(content).adjustments.rotationY).toBeCloseTo(2, 6)
  })

  /** What the standard cannot say is simply ABSENT, exactly as a `.ora` from elsewhere opens. */
  it('leaves the dials no glTF field holds at their neutral value', () => {
    const content = sky({
      adjustments: { ...createSkyboxContent().adjustments, exposure: 1.5, blur: 0.4 },
    })
    const read = rebuilt(content)

    expect(read.adjustments.exposure).toBe(0)
    expect(read.adjustments.blur).toBe(0)
  })

  it('finds the picture by the path the file points at', () => {
    expect(rebuilt(sky())).toMatchObject({ source: { assetId: 'asset-found' } })
  })

  /** Nothing to read the sun off: the default, never `NaN` from an `asin` of an empty rotation. */
  it('opens on the default sun when the file names no light of ours', () => {
    const read = skyFromGltf({ asset: { version: '2.0' } }, () => '')

    expect(read.sun).toEqual(createSkyboxContent().sun)
    expect(read.source).toBeNull()
  })
})

/**
 * The one reader of glTF this machine has, and the only proof available here that the file is a
 * file rather than JSON of the right shape: three.js parses it and hands back a scene.
 *
 * Blender is not installed, and no viewer that implements `EXT_lights_image_based` is either —
 * which is why the environment is NOT written as that extension. What is asserted is what three
 * really rebuilds: the light, its colour, its intensity, and the nodes the sky is made of.
 */
describe('what three.js makes of the file', () => {
  it('parses it, and gives the sun back as a directional light', async () => {
    const content = sky()
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')

    const parsed = await new Promise<{ scene: Object3D }>((resolve, reject) => {
      new GLTFLoader().parse(JSON.stringify(written(content)), '', resolve, reject)
    })

    const light = parsed.scene.getObjectByProperty('type', 'DirectionalLight')
    expect(light).toBeDefined()
    expect(light instanceof DirectionalLight && light.intensity).toBe(content.sun.intensity)
    expect(parsed.scene.getObjectByName('Horizon')).toBeDefined()
  })

  /** The direction three aims the light at, which is what a renderer other than this one uses. */
  it('aims that light where the sun stands, through three’s own transform', async () => {
    const content = sky()
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')

    const parsed = await new Promise<{ scene: Object3D }>((resolve, reject) => {
      new GLTFLoader().parse(JSON.stringify(written(content)), '', resolve, reject)
    })

    const light = parsed.scene.getObjectByProperty('type', 'DirectionalLight')
    if (!light) throw new Error('expected a light')
    light.updateWorldMatrix(true, false)
    // `+Z` of the node is where the sun stands; three's light travels down `-Z` from there.
    const aimed = new Vector3(0, 0, 1).applyQuaternion(light.getWorldQuaternion(new Quaternion()))
    const expected = directionFromAngles(content.sun)

    expect(aimed.x).toBeCloseTo(expected.x, 5)
    expect(aimed.y).toBeCloseTo(expected.y, 5)
    expect(aimed.z).toBeCloseTo(expected.z, 5)
  })
})

/** The pair the file layer leans on: every angle a drag can produce survives the crossing. */
describe('the angles a quaternion carries', () => {
  it.each([
    [0, 0],
    [80, 0],
    [-80, 359],
    [45, 90],
    [45, 270],
    [0, 180],
  ])('carries an elevation of %s° at an azimuth of %s°', (elevation, azimuth) => {
    const angles = { elevation: toRadians(elevation), azimuth: toRadians(azimuth) }
    const content = sky({ sun: { ...angles, intensity: 1, color: '#ffffff' } })
    const rotation = nodeNamed(written(content), 'Sun')?.rotation
    const read = anglesFromDirection(
      directionOfQuaternion(Array.isArray(rotation) ? rotation : []),
      { elevation: 0, azimuth: 0 },
    )

    expect(read.elevation).toBeCloseTo(angles.elevation, 6)
    expect(read.azimuth).toBeCloseTo(angles.azimuth, 6)
  })
})
