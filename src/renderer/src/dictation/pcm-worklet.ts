/**
 * Gathers microphone samples into chunks of a fixed size, on the audio thread.
 *
 * An `AudioWorkletProcessor` rather than the deprecated `ScriptProcessorNode`: that one runs on
 * the main thread, so a busy interface turns into dropped audio — and dropped audio is a
 * sentence that comes back with a hole in it.
 *
 * It does nothing but gather. A worklet cannot import anything, so any arithmetic written here
 * would be a second copy of what `domain/dictation.ts` already holds, and an untested one — the
 * conversion and the level are done by `capture.ts`, on 1600 values every 100 ms.
 *
 * Not part of the TypeScript projects' checked set the way the rest is: `AudioWorkletProcessor`
 * and `registerProcessor` live in the audio worklet global scope, which no lib describes.
 */

declare const sampleRate: number
declare function registerProcessor(name: string, processor: typeof PcmProcessor): void
declare const AudioWorkletProcessor: {
  new (): { readonly port: MessagePort }
}

/** The name `capture.ts` connects to. Written on both sides, and nowhere else. */
const PROCESSOR = 'pcm-collector'

type PcmOptions = { processorOptions?: { chunkSamples?: number } }

class PcmProcessor extends AudioWorkletProcessor {
  private readonly chunkSamples: number
  private held: Float32Array
  private at = 0

  constructor(options?: PcmOptions) {
    super()
    // Passed in rather than assumed: the chunk size belongs to the shared contract, and a
    // worklet has no way to read it from there.
    this.chunkSamples = options?.processorOptions?.chunkSamples ?? 1_600
    this.held = new Float32Array(this.chunkSamples)
  }

  process(inputs: Float32Array[][]): boolean {
    // One microphone, one channel — `getUserMedia` is asked for exactly that.
    const channel = inputs[0]?.[0]
    // No input at all means the track is not producing yet; the node stays alive waiting for it.
    if (!channel) return true

    for (const sample of channel) {
      this.held[this.at] = sample
      this.at += 1

      if (this.at < this.chunkSamples) continue

      // Transferred, not copied: this runs on the audio thread, and a copy of every chunk is
      // a copy the garbage collector has to clear between two renders of the level meter.
      const chunk = this.held
      this.port.postMessage({ chunk, sampleRate }, [chunk.buffer])
      this.held = new Float32Array(this.chunkSamples)
      this.at = 0
    }

    return true
  }
}

registerProcessor(PROCESSOR, PcmProcessor)
