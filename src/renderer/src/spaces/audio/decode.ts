import type { AudioData } from '@/engines/audio/audio-data'
import { fetchAsset } from '@/helpers/asset-fetch'

/**
 * Brings an asset's sound into memory, as plain arrays.
 *
 * `decodeAudioData` is the browser's own decoder — no ffmpeg, no wasm, nothing shipped for it.
 *
 * The context is closed straight away: only the samples are kept, and an `AudioContext` left
 * open holds an output device for as long as the tab lives.
 */
export async function decodeAsset(assetId: string): Promise<AudioData> {
  const response = await fetchAsset(assetId)

  const context = new AudioContext()
  try {
    const buffer = await context.decodeAudioData(await response.arrayBuffer())
    return {
      sampleRate: buffer.sampleRate,
      channels: Array.from({ length: buffer.numberOfChannels }, (_unused, channel) =>
        buffer.getChannelData(channel),
      ),
    }
  } finally {
    void context.close()
  }
}
