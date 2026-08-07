import { describe, expect, it } from 'vitest'
import {
  channelFromScenarioType,
  CHANNEL_BY_SCENARIO_TYPE,
  isPbrChannel,
  PBR_CHANNELS,
} from './texture'

describe('isPbrChannel', () => {
  it('accepts every declared channel', () => {
    for (const channel of PBR_CHANNELS) expect(isPbrChannel(channel)).toBe(true)
  })

  // The column is a free string in SQLite, and a catalogue outlives the build that wrote it.
  it('rejects what a catalogue row could hold', () => {
    expect(isPbrChannel('smoothness')).toBe(false)
    expect(isPbrChannel('metallic')).toBe(false)
    expect(isPbrChannel('')).toBe(false)
    expect(isPbrChannel(null)).toBe(false)
    expect(isPbrChannel(undefined)).toBe(false)
  })
})

describe('channelFromScenarioType', () => {
  it('reads the six channels the texture converter answers with', () => {
    expect(channelFromScenarioType('texture-albedo')?.channel).toBe('baseColor')
    expect(channelFromScenarioType('texture-normal')?.channel).toBe('normal')
    expect(channelFromScenarioType('texture-height')?.channel).toBe('height')
    expect(channelFromScenarioType('texture-metallic')?.channel).toBe('metalness')
    expect(channelFromScenarioType('texture-ao')?.channel).toBe('ao')
    expect(channelFromScenarioType('texture-edge')?.channel).toBe('edge')
  })

  // The converter answers with smoothness; the studio stores roughness. Same picture, read
  // the other way round — so the channel is roughness and the flag says which way.
  it('files a smoothness map as an inverted roughness', () => {
    expect(channelFromScenarioType('texture-smoothness')).toEqual({
      channel: 'roughness',
      inverted: true,
    })
  })

  // The other family says roughness where the first says smoothness: no flag there.
  it('takes a 3d roughness map at face value', () => {
    expect(channelFromScenarioType('3d-texture-roughness')).toEqual({ channel: 'roughness' })
  })

  it('reads the channels a textured mesh answers with', () => {
    expect(channelFromScenarioType('3d-texture-albedo')?.channel).toBe('baseColor')
    expect(channelFromScenarioType('3d-texture-normal')?.channel).toBe('normal')
    expect(channelFromScenarioType('3d-texture-metallic')?.channel).toBe('metalness')
  })

  // The API adds types without warning, and one of them must land as an ordinary picture
  // rather than vanish from the project.
  it('answers null for a type it has never heard of', () => {
    expect(channelFromScenarioType('inference-txt2img')).toBeNull()
    expect(channelFromScenarioType('texture-occlusion-v2')).toBeNull()
    expect(channelFromScenarioType(undefined)).toBeNull()
  })

  // Swept over the whole table rather than a handful: this is the one asymmetry between the
  // two families, and reading a normal or a height backwards would be invisible until render.
  it('never inverts anything but a smoothness map', () => {
    const inverted = Object.entries(CHANNEL_BY_SCENARIO_TYPE)
      .filter(([, source]) => source.inverted)
      .map(([type]) => type)

    expect(inverted).toEqual(['texture-smoothness'])
  })

  it('only ever answers with a channel the domain declares', () => {
    for (const source of Object.values(CHANNEL_BY_SCENARIO_TYPE)) {
      expect(isPbrChannel(source.channel)).toBe(true)
    }
  })
})
