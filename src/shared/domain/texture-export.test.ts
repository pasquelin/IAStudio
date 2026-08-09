import { describe, expect, it } from 'vitest'
import { PBR_CHANNELS, type PbrChannel } from './texture'
import {
  assetsOf,
  boundedSize,
  isTextureExportTarget,
  kindOf,
  maxSizeOf,
  resolvePictures,
  safeFileName,
  TEXTURE_EXPORT_TARGETS,
  type ExportChannels,
  type ResolvedComponent,
  type ResolvedPicture,
  type TextureExportTarget,
} from './texture-export'

/** The four that write a folder — the ones every recipe-wide assertion below walks. */
const FOLDER_TARGETS: readonly TextureExportTarget[] = ['unity', 'unreal', 'roblox', 'raw']

function channels(...present: PbrChannel[]): ExportChannels {
  return Object.fromEntries(present.map(channel => [channel, { assetId: `a-${channel}` }]))
}

const ALL = channels(...PBR_CHANNELS)

function pictureNamed(pictures: ResolvedPicture[], suffix: string): ResolvedPicture {
  const found = pictures.find(picture => picture.name === `mat${suffix}`)
  if (!found) throw new Error(`no picture named mat${suffix} among ${pictures.map(p => p.name)}`)
  return found
}

function reads(component: ResolvedComponent): { assetId: string; from: string; invert: boolean } {
  if ('constant' in component) throw new Error('expected a channel, found a constant')
  return component
}

function constant(component: ResolvedComponent): number {
  if (!('constant' in component)) throw new Error('expected a constant, found a channel')
  return component.constant
}

describe('the target registry', () => {
  it('names every target it lists, and nothing else', () => {
    expect(TEXTURE_EXPORT_TARGETS.filter(isTextureExportTarget)).toEqual(TEXTURE_EXPORT_TARGETS)
    expect(isTextureExportTarget('godot')).toBe(false)
    expect(isTextureExportTarget(undefined)).toBe(false)
  })

  it('sends glTF down its own road and the four others through pictures', () => {
    expect(kindOf('gltf')).toBe('gltf')
    for (const target of FOLDER_TARGETS) {
      expect(kindOf(target)).toBe('pictures')
    }
  })
})

describe('the glTF recipes', () => {
  it('names the slot each picture fills, so a rename cannot silently unwire one', () => {
    const roles = resolvePictures('gltf', ALL, 'mat').map(picture => picture.role)

    expect(roles).toEqual(['baseColor', 'normal', 'orm', 'emissive'])
  })

  it('packs its ORM exactly as the format reads it — occlusion, roughness, metallic', () => {
    const orm = pictureNamed(resolvePictures('gltf', ALL, 'mat'), '_ORM')

    expect(reads(orm.red).assetId).toBe('a-ao')
    expect(reads(orm.green).assetId).toBe('a-roughness')
    expect(reads(orm.blue).assetId).toBe('a-metalness')
  })

  it('leaves the normal in the convention the format states, green unflipped', () => {
    const normal = pictureNamed(resolvePictures('gltf', ALL, 'mat'), '_Normal')

    expect(reads(normal.green).invert).toBe(false)
  })

  it('carries no height, which the format has no slot for', () => {
    const names = resolvePictures('gltf', ALL, 'mat').map(picture => picture.name)

    expect(names).not.toContain('mat_Height')
  })

  it('gives no role to the pictures a folder-writing target resolves', () => {
    for (const target of FOLDER_TARGETS) {
      const roles = resolvePictures(target, ALL, 'mat').map(picture => picture.role)
      expect(roles.every(role => role === undefined)).toBe(true)
    }
  })
})

describe('the Unreal recipes', () => {
  it('packs occlusion on red, roughness on green and metallic on blue', () => {
    const orm = pictureNamed(resolvePictures('unreal', ALL, 'mat'), '_ORM')

    expect(reads(orm.red).assetId).toBe('a-ao')
    expect(reads(orm.green).assetId).toBe('a-roughness')
    expect(reads(orm.blue).assetId).toBe('a-metalness')
    expect(constant(orm.alpha)).toBe(1)
  })

  it('holds a missing occlusion open and a missing metalness shut', () => {
    const orm = pictureNamed(resolvePictures('unreal', channels('roughness'), 'mat'), '_ORM')

    expect(constant(orm.red)).toBe(1)
    expect(constant(orm.blue)).toBe(0)
    expect(reads(orm.green).assetId).toBe('a-roughness')
  })

  it('flips the green of the normal, and only the green', () => {
    const normal = pictureNamed(resolvePictures('unreal', ALL, 'mat'), '_Normal')

    expect(reads(normal.red).invert).toBe(false)
    expect(reads(normal.green).invert).toBe(true)
    expect(reads(normal.blue).invert).toBe(false)
    expect(reads(normal.green).from).toBe('g')
  })
})

describe('the Unity recipes', () => {
  it('packs metallic on red, occlusion on green and smoothness on alpha', () => {
    const mask = pictureNamed(resolvePictures('unity', ALL, 'mat'), '_MaskMap')

    expect(reads(mask.red).assetId).toBe('a-metalness')
    expect(reads(mask.green).assetId).toBe('a-ao')
    expect(constant(mask.blue)).toBe(0)
    expect(reads(mask.alpha).assetId).toBe('a-roughness')
  })

  it('writes smoothness where the studio holds roughness', () => {
    const mask = pictureNamed(resolvePictures('unity', ALL, 'mat'), '_MaskMap')

    expect(reads(mask.alpha).invert).toBe(true)
  })

  it('leaves a texture with no roughness fully rough, which is no smoothness at all', () => {
    const mask = pictureNamed(resolvePictures('unity', channels('metalness'), 'mat'), '_MaskMap')

    expect(constant(mask.alpha)).toBe(0)
  })
})

describe('a channel stored the other way round', () => {
  const smoothness: ExportChannels = {
    roughness: { assetId: 'a-roughness', inverted: true },
    ao: { assetId: 'a-ao' },
  }

  it('is put back the right way round for a slot that wants roughness', () => {
    const orm = pictureNamed(resolvePictures('unreal', smoothness, 'mat'), '_ORM')

    expect(reads(orm.green).invert).toBe(true)
  })

  it('is left alone for a slot that wants smoothness — two negations are none', () => {
    const mask = pictureNamed(resolvePictures('unity', smoothness, 'mat'), '_MaskMap')

    expect(reads(mask.alpha).invert).toBe(false)
  })

  it('goes out as roughness under the raw target, which names what it holds', () => {
    const roughness = pictureNamed(resolvePictures('raw', smoothness, 'mat'), '_Roughness')

    expect(reads(roughness.red).invert).toBe(true)
  })
})

describe('a normal that arrived in the other convention', () => {
  const directX: ExportChannels = { normal: { assetId: 'a-normal', greenFlipped: true } }

  it('is put back to OpenGL for a target that reads it that way', () => {
    const normal = pictureNamed(resolvePictures('gltf', directX, 'mat'), '_Normal')

    expect(reads(normal.green).invert).toBe(true)
    expect(reads(normal.red).invert).toBe(false)
    expect(reads(normal.blue).invert).toBe(false)
  })

  it('is left alone for Unreal, which wanted DirectX anyway', () => {
    const normal = pictureNamed(resolvePictures('unreal', directX, 'mat'), '_Normal')

    expect(reads(normal.green).invert).toBe(false)
  })

  it('is flipped for Unreal when it arrived as OpenGL', () => {
    const openGl: ExportChannels = { normal: { assetId: 'a-normal' } }
    const normal = pictureNamed(resolvePictures('unreal', openGl, 'mat'), '_Normal')

    expect(reads(normal.green).invert).toBe(true)
  })

  it('touches no channel but the normal', () => {
    const both: ExportChannels = {
      normal: { assetId: 'a-normal', greenFlipped: true },
      ao: { assetId: 'a-ao' },
      roughness: { assetId: 'a-roughness' },
      metalness: { assetId: 'a-metalness' },
    }
    const orm = pictureNamed(resolvePictures('unreal', both, 'mat'), '_ORM')

    expect([orm.red, orm.green, orm.blue].map(c => reads(c).invert)).toEqual([false, false, false])
  })
})

describe('the pictures an export writes', () => {
  it('drops one whose every component fell back to a constant', () => {
    const names = resolvePictures('unreal', channels('baseColor'), 'mat').map(p => p.name)

    expect(names).toEqual(['mat_BaseColor'])
  })

  it('keeps one where a single component still reads a channel', () => {
    const names = resolvePictures('unreal', channels('metalness'), 'mat').map(p => p.name)

    expect(names).toEqual(['mat_ORM'])
  })

  it('carries the cavity mask, which only the raw target has a file for', () => {
    const raw = resolvePictures('raw', ALL, 'mat').map(p => p.name)

    expect(raw).toContain('mat_Edge')
    expect(raw).toHaveLength(PBR_CHANNELS.length)
    for (const target of FOLDER_TARGETS.filter(target => target !== 'raw')) {
      expect(resolvePictures(target, ALL, 'mat').map(p => p.name)).not.toContain('mat_Edge')
    }
  })

  it('gives Roblox exactly the four maps a SurfaceAppearance takes', () => {
    expect(resolvePictures('roblox', ALL, 'mat').map(p => p.name)).toEqual([
      'mat_ColorMap',
      'mat_NormalMap',
      'mat_RoughnessMap',
      'mat_MetalnessMap',
    ])
  })

  it('names each file after the texture it came from', () => {
    expect(resolvePictures('roblox', ALL, 'Brique').map(p => p.name)).toContain('Brique_ColorMap')
  })

  it('reads a grey channel on red and writes it on three', () => {
    const roughness = pictureNamed(resolvePictures('roblox', ALL, 'mat'), '_RoughnessMap')

    expect(reads(roughness.red).from).toBe('r')
    expect(reads(roughness.green).from).toBe('r')
    expect(reads(roughness.blue).from).toBe('r')
  })

  it('reads a colour channel component by component', () => {
    const colour = pictureNamed(resolvePictures('roblox', ALL, 'mat'), '_ColorMap')

    expect([colour.red, colour.green, colour.blue].map(c => reads(c).from)).toEqual(['r', 'g', 'b'])
  })
})

describe('the assets one picture reads', () => {
  it('lists each once, however many components read it', () => {
    const colour = pictureNamed(resolvePictures('roblox', ALL, 'mat'), '_ColorMap')

    expect(assetsOf(colour)).toEqual(['a-baseColor'])
  })

  it('lists them in the order the components come, and skips the constants', () => {
    const orm = pictureNamed(resolvePictures('unreal', ALL, 'mat'), '_ORM')

    expect(assetsOf(orm)).toEqual(['a-ao', 'a-roughness', 'a-metalness'])
  })
})

describe('the size a target accepts', () => {
  it('caps Roblox at what the platform refuses above, and nothing else', () => {
    expect(maxSizeOf('roblox')).toBe(1024)
    for (const target of TEXTURE_EXPORT_TARGETS.filter(target => target !== 'roblox')) {
      expect(maxSizeOf(target)).toBeNull()
    }
  })

  it('leaves a picture already under the ceiling untouched', () => {
    expect(boundedSize({ width: 512, height: 256 }, 1024)).toEqual({ width: 512, height: 256 })
    expect(boundedSize({ width: 4096, height: 4096 }, null)).toEqual({ width: 4096, height: 4096 })
  })

  it('brings the longest side down to the ceiling, keeping the ratio', () => {
    expect(boundedSize({ width: 4096, height: 2048 }, 1024)).toEqual({ width: 1024, height: 512 })
    expect(boundedSize({ width: 2048, height: 4096 }, 1024)).toEqual({ width: 512, height: 1024 })
  })

  it('never lets a side round down to nothing', () => {
    expect(boundedSize({ width: 4096, height: 1 }, 1024)).toEqual({ width: 1024, height: 1 })
  })

  it('answers with a copy, so a caller cannot write into the size it asked about', () => {
    const size = { width: 512, height: 512 }
    const bounded = boundedSize(size, 1024)
    bounded.width = 1

    expect(size.width).toBe(512)
  })
})

describe('the name a folder takes', () => {
  it('leaves an ordinary title alone', () => {
    expect(safeFileName('Brique rouge')).toBe('Brique rouge')
  })

  it('takes the separators out of a title that reads as a path', () => {
    expect(safeFileName('Brique 1/2')).toBe('Brique 1 2')
    expect(safeFileName('..\\..\\etc')).toBe('etc')
  })

  it('drops the leading dots that would hide the folder', () => {
    expect(safeFileName('.hidden')).toBe('hidden')
  })

  it('takes out what Windows refuses in a name', () => {
    expect(safeFileName('a:b*c?d"e<f>g|h')).toBe('a b c d e f g h')
  })

  it('replaces a control character rather than carrying it to disk', () => {
    expect(safeFileName('tab\there')).toBe('tab here')
    expect(safeFileName('null byte')).toBe('null byte')
  })

  it('falls back when a title holds nothing a name can keep', () => {
    expect(safeFileName('///')).toBe('texture')
    expect(safeFileName('   ')).toBe('texture')
    expect(safeFileName('', 'sky')).toBe('sky')
  })

  it('cuts a very long title without leaving a trailing space', () => {
    const long = `${'a'.repeat(79)} tail`

    expect(safeFileName(long)).toBe('a'.repeat(79))
  })
})
