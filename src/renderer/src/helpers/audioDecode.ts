import type { AudioData } from '@/engines/audio/audioData'
import { decodeBytesOffThread } from '@/engines/audio/decodePort'
import { fetchAsset } from '@/helpers/assetFetch'

/**
 * Brings an asset's sound into memory, as plain arrays.
 *
 * Decoded in a worker: `decodeAudioData` on this thread froze the window for the length of the
 * take. The context is closed straight away when we fall back here — an `AudioContext` left open
 * holds an output device for as long as the tab lives.
 */
export async function decodeAsset(assetId: string): Promise<AudioData> {
  try {
    return await decodeBytesOffThread(await (await fetchAsset(assetId)).arrayBuffer())
  } catch {
    // Read again rather than kept: the port TRANSFERS the buffer, so holding a copy for this
    // path taxed every successful decode with the whole encoded file — 115 MB for ten minutes
    // of stereo WAV — to serve a fallback that runs when the worker itself failed.
    return decodeHere(await (await fetchAsset(assetId)).arrayBuffer())
  }
}

async function decodeHere(bytes: ArrayBuffer): Promise<AudioData> {
  const context = new AudioContext()
  try {
    const buffer = await context.decodeAudioData(bytes)
    return {
      sampleRate: buffer.sampleRate,
      channels: Array.from({ length: buffer.numberOfChannels }, (_unused, channel) =>
        buffer.getChannelData(channel).slice(),
      ),
    }
  } finally {
    void context.close()
  }
}
