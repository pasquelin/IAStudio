import { peaksFromSamples, type AudioData } from './audioData'
import type { DecodeWorkerRequest, DecodeWorkerResponse } from './decodeMessage'

async function audioOf(bytes: ArrayBuffer): Promise<AudioData> {
  const context = new OfflineAudioContext(1, 1, 44_100)
  const buffer = await context.decodeAudioData(bytes)
  return {
    sampleRate: buffer.sampleRate,
    channels: Array.from({ length: buffer.numberOfChannels }, (_unused, channel) =>
      buffer.getChannelData(channel).slice(),
    ),
  }
}

self.onmessage = (event: MessageEvent<DecodeWorkerRequest>): void => {
  const request = event.data
  void audioOf(request.bytes)
    .then(data => {
      if (request.kind === 'decode') {
        self.postMessage(
          {
            kind: 'decoded',
            id: request.id,
            sampleRate: data.sampleRate,
            channels: data.channels,
          } satisfies DecodeWorkerResponse,
          { transfer: data.channels.map(channel => channel.buffer) },
        )
        return
      }
      const peaks = peaksFromSamples(data, request.perSecond)
      self.postMessage({ kind: 'peaked', id: request.id, peaks } satisfies DecodeWorkerResponse, {
        transfer: [peaks.buffer],
      })
    })
    .catch((error: unknown) => {
      self.postMessage({
        kind: 'failed',
        id: request.id,
        message: error instanceof Error ? error.message : String(error),
      } satisfies DecodeWorkerResponse)
    })
}
