/**
 * A texture is not an image but a set of channels — see spec § 8.5. Each channel is an asset
 * of its own, exactly as Scenario returns them: one job of the texture converter answers with
 * several assets, each typed by its `metadata.type` and tied to its source by `parentId`.
 */
export type PbrChannel =
  'baseColor' | 'normal' | 'roughness' | 'metalness' | 'ao' | 'height' | 'emissive' | 'edge'

export const PBR_CHANNELS: readonly PbrChannel[] = [
  'baseColor',
  'normal',
  'roughness',
  'metalness',
  'ao',
  'height',
  'emissive',
  'edge',
]

export function isPbrChannel(value: unknown): value is PbrChannel {
  return PBR_CHANNELS.some(candidate => candidate === value)
}

/**
 * What a channel asset holds, once read off a generation.
 *
 * `inverted` exists because the API answers with a *smoothness* map where the studio stores
 * roughness — they are the same picture read the other way round. The pixels are kept as they
 * arrived, and the flag travels with them: flipping them here would mean a GPU pass in the
 * main process, which has no GPU, and would destroy what the API actually produced.
 */
export type ChannelSource = {
  channel: PbrChannel
  /** Absent unless the pixels read the other way round; there is only one such type. */
  inverted?: true
}

/**
 * Scenario's own channel vocabulary, in `metadata.type`. Two families answer here, and they
 * disagree: the texture converter says smoothness where a textured mesh says roughness.
 *
 * `emissive` is absent because no Scenario model produces one — it is only ever local.
 */
export const CHANNEL_BY_SCENARIO_TYPE: Record<string, ChannelSource> = {
  'texture-albedo': { channel: 'baseColor' },
  'texture-normal': { channel: 'normal' },
  'texture-height': { channel: 'height' },
  'texture-metallic': { channel: 'metalness' },
  'texture-ao': { channel: 'ao' },
  'texture-edge': { channel: 'edge' },
  'texture-smoothness': { channel: 'roughness', inverted: true },
  '3d-texture-albedo': { channel: 'baseColor' },
  '3d-texture-normal': { channel: 'normal' },
  '3d-texture-metallic': { channel: 'metalness' },
  '3d-texture-roughness': { channel: 'roughness' },
}

/**
 * The channel an API asset carries, or `null` when it carries none — a plain generated image,
 * or a type this build has never heard of. Unknown is not an error: the API adds types without
 * warning, and one of them must land in the project as an ordinary picture rather than vanish.
 */
export function channelFromScenarioType(metadataType: string | undefined): ChannelSource | null {
  return metadataType === undefined ? null : (CHANNEL_BY_SCENARIO_TYPE[metadataType] ?? null)
}
