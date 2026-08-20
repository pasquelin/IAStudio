import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Asset } from '@shared/domain/asset'
import { assistantAction } from '@shared/domain/assistant'
import { createSkyboxContent } from '@shared/domain/skybox'
import { newTexture, PREVIEW_SHAPES } from '@/engines/texture/textureState'
import { installFakeBridge } from '@/services/fakeBridge'
import { installIn } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { skyboxOf, skyboxStore, useSkyboxes } from '@/stores/skyboxes'
import { textureOf, textureStore, useTextures } from '@/stores/textures'
import { runAction } from './executor'

const SKY = 'doc-skybox'
const MATERIAL = 'doc-texture'

const PICTURE: Asset = {
  id: 'asset-sky',
  name: 'Coucher',
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-17T10:00:00.000Z',
  width: 4096,
  height: 2048,
}

const sky = () => skyboxOf(useSkyboxes.getState(), SKY)
const material = () => textureOf(useTextures.getState(), MATERIAL)

function withSky(): void {
  installIn(skyboxStore, SKY, createSkyboxContent(), 'skyboxes')
}

function withMaterial(): void {
  installIn(textureStore, MATERIAL, newTexture(), 'textures')
}

beforeEach(() => {
  installFakeBridge({ assets: { search: vi.fn(async () => [PICTURE]) } })
  withSky()
})

describe('the sky', () => {
  it('answers its source, its dials, its sun and what it lights', async () => {
    const outcome = await runAction('skybox.state', {})

    expect(outcome).toMatchObject({
      ok: true,
      data: { documentId: SKY, source: null, adjustments: { exposure: 0 } },
    })
  })

  it('changes only the dials it was given, and puts them all back at once', async () => {
    await runAction('skybox.adjust', { exposure: 1.5, blur: 0.25 })
    expect(sky().adjustments).toMatchObject({ exposure: 1.5, blur: 0.25, contrast: 1 })

    await runAction('skybox.resetAdjustments', {})
    expect(sky().adjustments).toMatchObject({ exposure: 0, blur: 0 })
  })

  it('places the sun and sets what the image lights', async () => {
    await runAction('skybox.sun', { elevation: 0.4, intensity: 2, color: '#ffddaa' })
    expect(sky().sun).toMatchObject({ elevation: 0.4, intensity: 2, color: '#ffddaa' })

    await runAction('skybox.environment', { intensity: 0.5, showBackground: false })
    expect(sky().environment).toEqual({ intensity: 0.5, showBackground: false })
  })

  it('hangs a picture of the library in the sky', async () => {
    expect(await runAction('skybox.source', { assetId: PICTURE.id })).toEqual({ ok: true })
    expect(sky().source).toEqual({ assetId: PICTURE.id })
  })

  /**
   * `setSkyboxSource` refuses a picture with no local file in SILENCE — the guard a drop meets —
   * so the source is read back to tell a refusal from a hanging.
   */
  it('refuses a picture that is still in the cloud', async () => {
    const inCloud: Asset = { ...PICTURE, location: 'cloud' }
    installFakeBridge({ assets: { search: vi.fn(async () => [inCloud]) } })

    expect(await runAction('skybox.source', { assetId: PICTURE.id })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(sky().source).toBeNull()
  })

  // A call that names no dial at all would be an empty history entry.
  it('refuses a call that changes nothing', async () => {
    expect(await runAction('skybox.adjust', {})).toEqual({ ok: false, refusal: 'badInput' })
  })

  it('refuses every action of the family while no sky is in front', async () => {
    useDocuments.setState({ documents: {}, activeId: null })

    expect(await runAction('skybox.state', {})).toEqual({ ok: false, refusal: 'wrongSurface' })
  })
})

describe('the material', () => {
  beforeEach(() => {
    withMaterial()
  })

  it('answers its channels, its render settings and its preview', async () => {
    expect(await runAction('texture.state', {})).toMatchObject({
      ok: true,
      data: { documentId: MATERIAL, channels: {} },
    })
  })

  it('changes only the settings it was given', async () => {
    await runAction('texture.material', { roughness: 0.2, color: '#334455' })

    expect(material().material).toMatchObject({ roughness: 0.2, color: '#334455' })
    expect(material().material.metalness).toBe(newTexture().material.metalness)
  })

  /** `tiling` is one vector, so a call naming one axis has to carry the other one through. */
  it('keeps the axis a tiling call did not name', async () => {
    await runAction('texture.material', { tilingX: 4 })

    expect(material().material.tiling).toEqual({ x: 4, y: newTexture().material.tiling.y })
  })

  it('sets how the preview is presented', async () => {
    await runAction('texture.preview', { envIntensity: 2, showSeam: true, autoSpin: false })

    expect(material().preview).toMatchObject({ envIntensity: 2, showSeam: true, autoSpin: false })
  })

  it('fills a channel from the library and empties it again', async () => {
    expect(await runAction('texture.channel', { channel: 'normal', assetId: PICTURE.id })).toEqual({
      ok: true,
    })
    expect(material().channels.normal).toMatchObject({ assetId: PICTURE.id, width: 4096 })

    await runAction('texture.channel', { channel: 'normal' })
    expect(material().channels.normal).toBeUndefined()
  })

  it('refuses a channel the material does not have', async () => {
    expect(await runAction('texture.channel', { channel: 'gloss' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  /**
   * A style is a material kept aside, so it is saved FROM the one in front rather than from
   * values a client restates — a second way of building one is a second set of defaults.
   */
  it('saves the material in front as a style, and refuses with none in front', async () => {
    const save = vi.fn(async () => [])
    installFakeBridge({ styles: { save } })

    expect(await runAction('style.save', { name: 'Pierre' })).toMatchObject({ ok: true })
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ values: material().material, name: expect.any(String) }),
    )

    useDocuments.setState({ documents: {}, activeId: null })
    expect(await runAction('style.save', { name: 'Pierre' })).toEqual({
      ok: false,
      refusal: 'wrongSurface',
    })
  })

  it('renames and removes a style through their own channels', async () => {
    const rename = vi.fn(async () => [])
    const remove = vi.fn(async () => [])
    installFakeBridge({ styles: { rename, remove } })

    await runAction('style.rename', { styleId: 'style-1', name: 'Béton' })
    await runAction('style.remove', { styleId: 'style-1' })

    expect(rename).toHaveBeenCalledWith('style-1', 'Béton')
    expect(remove).toHaveBeenCalledWith('style-1')
  })
})

/**
 * The one closed list of this family the registry writes out — the shapes live in the texture
 * engine, which `shared/` may not import. This is what holds the copy to its original.
 */
describe('what the registry offers a preview', () => {
  it('offers exactly the shapes the engine declares', () => {
    const field = assistantAction('texture.preview')?.fields.find(one => one.key === 'shape')

    expect([...(field?.options ?? [])]).toEqual([...PREVIEW_SHAPES])
  })
})

describe('how a sky is looked at', () => {
  it('writes the projection, the lens and the probes, and reads them back', async () => {
    withSky()

    expect(await runAction('skybox.view', { view: 'equirect', probes: false })).toEqual({
      ok: true,
    })

    const outcome = await runAction('skybox.state', {})
    expect(outcome).toMatchObject({
      ok: true,
      data: { view: { view: 'equirect', probes: false } },
    })
  })

  it('refuses a call that names nothing at all', async () => {
    withSky()

    expect(await runAction('skybox.view', {})).toEqual({ ok: false, refusal: 'badInput' })
  })
})

describe('the two halves of a material nothing could write', () => {
  it('remaps a channel one bound at a time, keeping the other', async () => {
    withMaterial()

    expect(await runAction('texture.material', { roughnessMin: 0.2 })).toEqual({ ok: true })
    expect(material().material.roughnessRange).toEqual({ min: 0.2, max: 1 })

    await runAction('texture.material', { roughnessMax: 0.8, metalnessMin: 0.1 })
    expect(material().material.roughnessRange).toEqual({ min: 0.2, max: 0.8 })
    expect(material().material.metalnessRange).toEqual({ min: 0.1, max: 1 })
  })

  it('judges the material on another shape, at another repeat', async () => {
    withMaterial()

    expect(await runAction('texture.preview', { shape: 'plane', tilingPreview: 4 })).toEqual({
      ok: true,
    })
    expect(material().preview).toMatchObject({ shape: 'plane', tilingPreview: 4 })
  })

  /** One, two or four: a bound cannot say « three is not offered », so the handler does. */
  it('refuses a repeat the panel does not offer', async () => {
    withMaterial()

    expect(await runAction('texture.preview', { tilingPreview: 3 })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })
})
