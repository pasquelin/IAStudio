import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { HEX_COLOR } from '@shared/domain/color'
import type { SkyboxContent } from '@shared/domain/skybox'
import { PBR_CHANNELS, type PbrChannel } from '@shared/domain/texture'
import type { Command } from '@/engines/core/history'
import {
  resetAdjustments,
  setAdjustment,
  setEnvironmentSetting,
  setSunSetting,
} from '@/engines/skybox/commands'
import { setChannel, setPreview, setTextureMaterial } from '@/engines/texture/commands'
import type { TextureState } from '@/engines/texture/textureState'
import { activeSkyboxId, activeTextureId, useDocuments } from '@/stores/documents'
import { setSkyboxSource, skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { textureOf, useTextures } from '@/stores/textures'
import { withAsset, type ActionHandlers } from './actionHandler'
import { boolOf, numberOf, oneOf, textOf } from './actionInputs'

/**
 * The sky and the material, driven by value.
 *
 * Both engines take one dial at a time, and that is what these hand them: an entry per dial, never
 * wrapped in a gesture. Coalescing merges commands sharing an `id` and keeps the FIRST one's
 * revert, so one entry around three different dials would undo the exposure and leave the blur.
 */

/** The sky in front and its state, or nothing — which reads as `wrongSurface`. */
function skyOpen(): { documentId: string; state: SkyboxContent } | null {
  const documentId = activeSkyboxId(useDocuments.getState())
  return documentId === null
    ? null
    : { documentId, state: skyboxOf(useSkyboxes.getState(), documentId) }
}

function materialOpen(): { documentId: string; state: TextureState } | null {
  const documentId = activeTextureId(useDocuments.getState())
  return documentId === null
    ? null
    : { documentId, state: textureOf(useTextures.getState(), documentId) }
}

function runSky(commands: readonly Command<SkyboxContent>[]): ActionOutcome {
  const open = skyOpen()
  if (!open) return refused('wrongSurface')
  if (commands.length === 0) return refused('badInput')

  for (const command of commands) useSkyboxes.getState().runCommand(open.documentId, command)
  return { ok: true }
}

function runMaterial(commands: readonly Command<TextureState>[]): ActionOutcome {
  const open = materialOpen()
  if (!open) return refused('wrongSurface')
  if (commands.length === 0) return refused('badInput')

  for (const command of commands) useTextures.getState().runCommand(open.documentId, command)
  return { ok: true }
}

/**
 * The dials a call actually named, each as its own command. Absent means "leave it alone".
 *
 * A table of concrete builders rather than a key and a cast: `setAdjustment<K>` wants a value of
 * `AdjustmentStack[K]`, which no generic hand-off can promise, and the cast that silences it is
 * exactly what would let a renamed dial through.
 */
type Dials<S> = Record<string, (value: number) => Command<S>>

function dialsOf<S>(input: Record<string, unknown>, dials: Dials<S>): Command<S>[] {
  return Object.entries(dials).flatMap(([key, build]) => {
    const value = numberOf(input, key)
    return value === null ? [] : [build(value)]
  })
}

/** The same for a switch, read through the KEY: absent leaves it, present writes it. */
function switchesOf<S>(
  input: Record<string, unknown>,
  switches: Record<string, (value: boolean) => Command<S>>,
): Command<S>[] {
  return Object.entries(switches).flatMap(([key, build]) =>
    input[key] === undefined ? [] : [build(boolOf(input, key))],
  )
}

const ADJUSTMENTS: Dials<SkyboxContent> = {
  exposure: value => setAdjustment('exposure', value),
  contrast: value => setAdjustment('contrast', value),
  saturation: value => setAdjustment('saturation', value),
  temperature: value => setAdjustment('temperature', value),
  tint: value => setAdjustment('tint', value),
  rotationY: value => setAdjustment('rotationY', value),
  blur: value => setAdjustment('blur', value),
}

const adjust = (input: Record<string, unknown>): ActionOutcome =>
  runSky(dialsOf(input, ADJUSTMENTS))

const SUN: Dials<SkyboxContent> = {
  elevation: value => setSunSetting('elevation', value),
  azimuth: value => setSunSetting('azimuth', value),
  intensity: value => setSunSetting('intensity', value),
}

function sun(input: Record<string, unknown>): ActionOutcome {
  const colour = textOf(input, 'color')

  return runSky([
    ...dialsOf(input, SUN),
    // The registry already refuses anything but a hex, so one that arrives here is readable.
    ...(colour !== null && HEX_COLOR.test(colour) ? [setSunSetting('color', colour)] : []),
  ])
}

function environment(input: Record<string, unknown>): ActionOutcome {
  return runSky([
    ...dialsOf<SkyboxContent>(input, {
      intensity: value => setEnvironmentSetting('intensity', value),
    }),
    ...switchesOf<SkyboxContent>(input, {
      showBackground: value => setEnvironmentSetting('showBackground', value),
    }),
  ])
}

function readSky(): ActionOutcome {
  const open = skyOpen()
  if (!open) return refused('wrongSurface')

  return {
    ok: true,
    data: {
      documentId: open.documentId,
      source: open.state.source,
      adjustments: open.state.adjustments,
      sun: open.state.sun,
      environment: open.state.environment,
      ...(open.state.generation === undefined ? {} : { generation: open.state.generation }),
    },
  }
}

const MATERIAL_DIALS: Dials<TextureState> = {
  roughness: value => setTextureMaterial('roughness', value),
  metalness: value => setTextureMaterial('metalness', value),
  normalScale: value => setTextureMaterial('normalScale', value),
  heightScale: value => setTextureMaterial('heightScale', value),
  aoIntensity: value => setTextureMaterial('aoIntensity', value),
  edgeIntensity: value => setTextureMaterial('edgeIntensity', value),
  emissiveIntensity: value => setTextureMaterial('emissiveIntensity', value),
  rotation: value => setTextureMaterial('rotation', value),
}

const PREVIEW_DIALS: Dials<TextureState> = {
  envIntensity: value => setPreview('envIntensity', value),
  envRotation: value => setPreview('envRotation', value),
}

type VectorKey = 'tiling' | 'offset'

const VECTOR_KEYS: readonly VectorKey[] = ['tiling', 'offset']

/** `tiling` and `offset` are one vector each, so a call naming one axis has to carry the other. */
function vectorCommands(
  input: Record<string, unknown>,
  state: TextureState,
): Command<TextureState>[] {
  return VECTOR_KEYS.flatMap(key => {
    const x = numberOf(input, `${key}X`)
    const y = numberOf(input, `${key}Y`)
    return x === null && y === null
      ? []
      : [
          setTextureMaterial(key, {
            x: x ?? state.material[key].x,
            y: y ?? state.material[key].y,
          }),
        ]
  })
}

function material(input: Record<string, unknown>): ActionOutcome {
  const open = materialOpen()
  if (!open) return refused('wrongSurface')

  const colour = textOf(input, 'color')
  const emissive = textOf(input, 'emissive')

  return runMaterial([
    ...dialsOf(input, MATERIAL_DIALS),
    ...vectorCommands(input, open.state),
    ...(colour === null ? [] : [setTextureMaterial('color', colour)]),
    ...(emissive === null ? [] : [setTextureMaterial('emissive', emissive)]),
    ...switchesOf<TextureState>(input, {
      invertNormalGreen: value => setTextureMaterial('invertNormalGreen', value),
    }),
  ])
}

function preview(input: Record<string, unknown>): ActionOutcome {
  return runMaterial([
    ...dialsOf(input, PREVIEW_DIALS),
    ...switchesOf<TextureState>(input, {
      showBackground: value => setPreview('showBackground', value),
      autoSpin: value => setPreview('autoSpin', value),
      showSeam: value => setPreview('showSeam', value),
    }),
  ])
}

function readMaterial(): ActionOutcome {
  const open = materialOpen()
  if (!open) return refused('wrongSurface')

  return {
    ok: true,
    data: {
      documentId: open.documentId,
      channels: open.state.channels,
      material: open.state.material,
      preview: open.state.preview,
    },
  }
}

/**
 * Fills one channel from the library, or empties it when no asset is named.
 *
 * Through `placeTextureChannel`, which the drop and the shelf menu already go through: it is the
 * one place that refuses an asset with no local file, and a second way in would be a second answer
 * to that question.
 */
async function channel(input: Record<string, unknown>): Promise<ActionOutcome> {
  const open = materialOpen()
  if (!open) return refused('wrongSurface')

  const which: PbrChannel | null = oneOf(input, 'channel', PBR_CHANNELS)
  if (!which) return refused('badInput')

  const assetId = textOf(input, 'assetId')
  if (assetId === null) return runMaterial([setChannel(which, null)])

  // Loaded on the call rather than imported at the top: this table is evaluated by the first
  // screen, and `eager-graph.test.ts` holds that chunk to reaching no third module out of an
  // editor's folder.
  const { placeTextureChannel } = await import('@/spaces/textures/placeChannel')
  return withAsset(assetId, asset =>
    placeTextureChannel(open.documentId, asset, which) ? { ok: true } : refused('badInput'),
  )
}

export const MATERIAL_HANDLERS: ActionHandlers = {
  'skybox.state': readSky,
  'skybox.adjust': adjust,
  'skybox.resetAdjustments': () => runSky([resetAdjustments()]),
  'skybox.sun': sun,
  'skybox.environment': environment,

  'skybox.source': input => {
    const open = skyOpen()
    if (!open) return refused('wrongSurface')

    return withAsset(textOf(input, 'assetId') ?? '', asset => {
      // Answers nothing, and refuses in silence for an asset with no local file — the same guard
      // the drop meets. Reading the source back is what tells the two apart.
      setSkyboxSource(open.documentId, asset)
      return skyboxOf(useSkyboxes.getState(), open.documentId).source?.assetId === asset.id
        ? { ok: true }
        : refused('badInput')
    })
  },

  'texture.state': readMaterial,
  'texture.material': material,
  'texture.preview': preview,
  'texture.channel': channel,
}
