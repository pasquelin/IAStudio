import { describe, expect, it } from 'vitest'
import { isPbrChannel, PBR_CHANNELS } from '@shared/domain/texture'
import {
  canDerive,
  DEFAULT_PREVIEW,
  DEFAULT_TEXTURE_MATERIAL,
  missingChannels,
  newTexture,
  parseTexture,
  resetMaterial,
  slotFor,
  sourceFor,
  type ChannelMap,
  type TextureState,
} from './texture-state'

function mapOf(assetId: string): ChannelMap {
  return { assetId, origin: 'imported', width: 1024, height: 1024 }
}

function textureWith(channels: TextureState['channels']): TextureState {
  return { ...newTexture(), channels }
}

describe('slotFor', () => {
  it('names the map slot three reads each channel from', () => {
    expect(slotFor('baseColor')).toBe('map')
    expect(slotFor('normal')).toBe('normalMap')
    expect(slotFor('roughness')).toBe('roughnessMap')
    expect(slotFor('metalness')).toBe('metalnessMap')
    expect(slotFor('ao')).toBe('aoMap')
    expect(slotFor('height')).toBe('displacementMap')
    expect(slotFor('emissive')).toBe('emissiveMap')
  })

  // A cavity mask has no standard slot: it is read in `onBeforeCompile`, and a channel with
  // nowhere to go must say so rather than land in whichever slot looks close.
  it('gives the edge channel no slot at all', () => {
    expect(slotFor('edge')).toBeNull()
  })

  it('never sends two channels to the same slot', () => {
    const slots = PBR_CHANNELS.map(slotFor).filter(slot => slot !== null)
    expect(slots).toHaveLength(PBR_CHANNELS.length - 1)
    expect(new Set(slots).size).toBe(slots.length)
  })
})

describe('sourceFor', () => {
  it('reads a normal and an occlusion out of a height map', () => {
    expect(sourceFor('normal')).toBe('height')
    expect(sourceFor('ao')).toBe('height')
  })

  it('reads a height and a roughness out of the base colour', () => {
    expect(sourceFor('height')).toBe('baseColor')
    expect(sourceFor('roughness')).toBe('baseColor')
  })

  // Metalness is not in the pixels of a photograph, and no Scenario model answers with an
  // emissive at all: offering to compute either would be offering a guess.
  it('leaves alone what no shader can guess', () => {
    expect(sourceFor('baseColor')).toBeNull()
    expect(sourceFor('metalness')).toBeNull()
    expect(sourceFor('emissive')).toBeNull()
    expect(sourceFor('edge')).toBeNull()
  })

  // A cycle would make a channel wait on itself: the recompute that follows a source change
  // would never reach the end of the chain.
  it('always ends on a channel that derives from nothing', () => {
    for (const channel of PBR_CHANNELS) {
      const seen = new Set([channel])
      let current = sourceFor(channel)

      while (current !== null) {
        expect(seen.has(current)).toBe(false)
        seen.add(current)
        current = sourceFor(current)
      }
    }
  })
})

describe('canDerive', () => {
  it('answers yes once the pixels it needs are there', () => {
    expect(canDerive(textureWith({ height: mapOf('h') }), 'normal')).toBe(true)
  })

  it('answers no while its source is missing', () => {
    expect(canDerive(textureWith({ baseColor: mapOf('b') }), 'normal')).toBe(false)
  })

  it('answers no for a channel nothing derives', () => {
    expect(canDerive(textureWith({ baseColor: mapOf('b') }), 'metalness')).toBe(false)
  })

  // "Derivable" is about the source, not about the target: a derived channel is recomputed
  // whenever what it was read from changes.
  it('still answers yes when the channel already holds a map', () => {
    const texture = textureWith({ height: mapOf('h'), normal: mapOf('n') })
    expect(canDerive(texture, 'normal')).toBe(true)
  })
})

describe('missingChannels', () => {
  it('lists what is still empty, in the order the strip shows them', () => {
    const texture = textureWith({ baseColor: mapOf('b'), roughness: mapOf('r') })
    expect(missingChannels(texture)).toEqual([
      'normal',
      'metalness',
      'ao',
      'height',
      'emissive',
      'edge',
    ])
  })

  it('answers empty once every channel is filled', () => {
    const filled = Object.fromEntries(PBR_CHANNELS.map(channel => [channel, mapOf(channel)]))
    expect(missingChannels(textureWith(filled))).toEqual([])
  })
})

describe('newTexture', () => {
  it('opens on the defaults, with no channel', () => {
    const texture = newTexture()
    expect(texture.channels).toEqual({})
    expect(texture.material).toEqual(DEFAULT_TEXTURE_MATERIAL)
    expect(texture.preview).toEqual(DEFAULT_PREVIEW)
  })

  // The defaults are shared by every document ever opened: handed out by reference, the first
  // slider drag would rewrite what every other texture opens on.
  it('hands back a copy rather than the defaults themselves', () => {
    const texture = newTexture()
    texture.material.tiling.x = 8
    texture.preview.environment = { kind: 'skybox', assetId: 'sky' }

    expect(DEFAULT_TEXTURE_MATERIAL.tiling.x).toBe(1)
    expect(DEFAULT_PREVIEW.environment).toEqual({ kind: 'studio' })
  })
})

describe('resetMaterial', () => {
  it('gives the material back its defaults', () => {
    const edited: TextureState = {
      ...newTexture(),
      material: { ...DEFAULT_TEXTURE_MATERIAL, roughness: 0.2, invertNormalGreen: true },
    }

    expect(resetMaterial(edited).material).toEqual(DEFAULT_TEXTURE_MATERIAL)
  })

  it('leaves the channels and the preview alone', () => {
    const texture: TextureState = {
      channels: { baseColor: mapOf('b') },
      material: { ...DEFAULT_TEXTURE_MATERIAL, metalness: 1 },
      preview: { ...DEFAULT_PREVIEW, autoSpin: true },
    }

    const reset = resetMaterial(texture)
    expect(reset.channels).toEqual(texture.channels)
    expect(reset.preview).toEqual(texture.preview)
  })

  it('hands back a copy rather than the defaults themselves', () => {
    const reset = resetMaterial(newTexture())
    reset.material.roughnessRange.min = 0.5

    expect(DEFAULT_TEXTURE_MATERIAL.roughnessRange.min).toBe(0)
  })
})

describe('parseTexture', () => {
  // Every field moved off its default: a reader that quietly handed the default back would pass
  // a round trip written from `{ ...DEFAULT }`, and the setting would be lost on every reload.
  it('reads back what an editor wrote, field by field', () => {
    const written: TextureState = {
      channels: {
        baseColor: { assetId: 'a1', origin: 'generated', modelId: 'm', width: 512, height: 512 },
        normal: { assetId: 'a2', origin: 'derived', width: 512, height: 512 },
      },
      material: {
        color: '#804020',
        roughness: 0.4,
        metalness: 0.6,
        roughnessRange: { min: 0.2, max: 0.8 },
        metalnessRange: { min: 0.1, max: 0.9 },
        normalScale: -2,
        invertNormalGreen: true,
        heightScale: 0.05,
        aoIntensity: 0.7,
        edgeIntensity: 0.3,
        emissive: '#112233',
        emissiveIntensity: 2.5,
        tiling: { x: 4, y: 2 },
        offset: { x: 0.25, y: 0.75 },
        rotation: 1.5,
      },
      preview: {
        shape: 'plane',
        environment: { kind: 'skybox', assetId: 'sky' },
        envIntensity: 1.5,
        envRotation: 0.5,
        showBackground: false,
        autoSpin: true,
        tilingPreview: 2,
      },
    }

    expect(parseTexture(JSON.parse(JSON.stringify(written)))).toEqual(written)
  })

  // A `.tex` written before a setting existed must open, not be refused: the missing value is
  // what the studio would have used anyway.
  it('fills in what an older build never wrote', () => {
    const parsed = parseTexture({ channels: {}, material: { roughness: 0.25 } })
    expect(parsed.material.roughness).toBe(0.25)
    expect(parsed.material.tiling).toEqual(DEFAULT_TEXTURE_MATERIAL.tiling)
    expect(parsed.preview).toEqual(DEFAULT_PREVIEW)
  })

  it('drops a channel a hand edit invented', () => {
    const parsed = parseTexture({ channels: { glitter: { assetId: 'g', width: 8, height: 8 } } })
    expect(parsed.channels).toEqual({})
  })

  it('drops a channel entry with no asset behind it', () => {
    expect(parseTexture({ channels: { normal: { origin: 'derived' } } }).channels).toEqual({})
    expect(parseTexture({ channels: { normal: { assetId: '' } } }).channels).toEqual({})
  })

  it('keeps the flag that says a channel reads the other way round', () => {
    const parsed = parseTexture({
      channels: {
        roughness: { assetId: 'r', origin: 'generated', width: 4, height: 4, inverted: true },
      },
    })

    expect(parsed.channels.roughness?.inverted).toBe(true)
  })

  it('files a channel of unknown origin as imported', () => {
    const parsed = parseTexture({ channels: { ao: { assetId: 'a', origin: 'conjured' } } })
    expect(parsed.channels.ao?.origin).toBe('imported')
  })

  it('refuses a skybox environment that names no asset', () => {
    const parsed = parseTexture({ preview: { environment: { kind: 'skybox' } } })
    expect(parsed.preview.environment).toEqual({ kind: 'studio' })
  })

  it('refuses a preview repeat the viewport cannot show', () => {
    expect(parseTexture({ preview: { tilingPreview: 3 } }).preview.tilingPreview).toBe(1)
    expect(parseTexture({ preview: { tilingPreview: 4 } }).preview.tilingPreview).toBe(4)
  })

  // Total, like the other spaces deserialize: a blank texture beats an uncaught throw on the
  // way to the screen.
  it('opens blank on what is not a texture at all', () => {
    expect(parseTexture('a texture')).toEqual(newTexture())
    expect(parseTexture(null)).toEqual(newTexture())
    expect(parseTexture(42)).toEqual(newTexture())
  })

  it('only ever answers with channels the domain declares', () => {
    const parsed = parseTexture({
      channels: { baseColor: { assetId: 'b' }, nonsense: { assetId: 'n' } },
    })

    expect(Object.keys(parsed.channels)).toEqual(['baseColor'])
    for (const channel of Object.keys(parsed.channels)) expect(isPbrChannel(channel)).toBe(true)
  })

  // A hand-edited file is user territory, and a roughness of -1 reaches the shader as a negative
  // alpha: black or white pixels depending on the driver, with nothing on the way to say why.
  it('holds a value inside what it means', () => {
    const parsed = parseTexture({
      material: { roughness: -1, metalness: 5, aoIntensity: 2, emissiveIntensity: -3 },
      preview: { envIntensity: -1 },
    })

    expect(parsed.material.roughness).toBe(0)
    expect(parsed.material.metalness).toBe(1)
    expect(parsed.material.aoIntensity).toBe(1)
    expect(parsed.material.emissiveIntensity).toBe(0)
    expect(parsed.preview.envIntensity).toBe(0)
  })

  it('puts crossed remap handles back in order', () => {
    const parsed = parseTexture({ material: { roughnessRange: { min: 0.9, max: 0.1 } } })
    expect(parsed.material.roughnessRange).toEqual({ min: 0.9, max: 0.9 })
  })

  // Signed on purpose: a negative scale flips a normal map baked the other way round.
  it('leaves a signed setting its sign', () => {
    const parsed = parseTexture({ material: { normalScale: -2, offset: { x: -0.5, y: 0.5 } } })
    expect(parsed.material.normalScale).toBe(-2)
    expect(parsed.material.offset).toEqual({ x: -0.5, y: 0.5 })
  })

  // Badged derived, it would promise a recompute that no source can ever trigger.
  it('refuses a derived badge on a channel nothing derives', () => {
    const parsed = parseTexture({
      channels: {
        metalness: { assetId: 'm', origin: 'derived' },
        normal: { assetId: 'n', origin: 'derived' },
      },
    })

    expect(parsed.channels.metalness?.origin).toBe('imported')
    expect(parsed.channels.normal?.origin).toBe('derived')
  })
})
