/**
 * The surface of `sherpa-onnx-node` the studio uses. The package ships JSDoc typedefs in a `.js`
 * file and no declaration at all, so what is called is declared here, narrowly: a declaration
 * nobody can drift from is worth more than a complete one.
 *
 * Only the recognition half is described. The package also carries text-to-speech, speaker
 * diarization, keyword spotting and language identification, none of which this studio uses —
 * declaring them would invite a call the packaging was never checked against.
 *
 * Under `shared/types/` beside `opentype.d.ts`, for the same reason: it is the one folder both
 * TypeScript projects include. Nothing outside the main process ever imports the module itself,
 * and nothing ever could — it loads a native addon.
 *
 * **The default export is the only way in.** The package is CommonJS and builds its exports
 * from property accesses (`OfflineRecognizer: non_streaming_asr.OfflineRecognizer`), which
 * Node's CommonJS lexer cannot see through — so `import { Vad }` compiles happily and then
 * throws `Named export 'Vad' not found` the first time the worker runs.
 */
declare module 'sherpa-onnx-node' {
  /** A closed stretch of speech, as the detector hands it over. */
  export type SpeechSegment = {
    /** Where it starts in the stream the detector has been fed, in samples. */
    start: number
    samples: Float32Array
  }

  export type SileroVadModelConfig = {
    model: string
    /** How loud a frame has to be to count as speech, 0 to 1. */
    threshold?: number
    /** Quiet that closes a segment, in SECONDS — the setting is stored in milliseconds. */
    minSilenceDuration?: number
    /** Speech shorter than this is not a segment: a cough, a click, a chair. In seconds. */
    minSpeechDuration?: number
    /** Frames the detector reads at once. 512 at 16 kHz is what Silero was trained on. */
    windowSize?: number
    /** A segment is closed at this length even mid-sentence, in seconds. */
    maxSpeechDuration?: number
  }

  export type VadConfig = {
    sileroVad: SileroVadModelConfig
    sampleRate: number
    numThreads?: number
    provider?: string
    debug?: boolean
  }

  export class Vad {
    constructor(config: VadConfig, bufferSizeInSeconds: number)
    /** Float32 samples in [-1, 1], at the rate the config declares. */
    acceptWaveform(samples: Float32Array): void
    /** No closed segment is waiting. */
    isEmpty(): boolean
    /** Someone is speaking right now — which is not the same as a segment being ready. */
    isDetected(): boolean
    /** The oldest closed segment. Undefined behaviour while `isEmpty()`. */
    front(enableExternalBuffer?: boolean): SpeechSegment
    /** Drops the segment `front` returned. Nothing else advances the queue. */
    pop(): void
    /** Drops every closed segment, keeping the detector's own state. */
    clear(): void
    reset(): void
    /** Closes the speech in flight, so the last words become a segment instead of being lost. */
    flush(): void
  }

  export type OfflineTransducerModelConfig = {
    encoder: string
    decoder: string
    joiner: string
  }

  export type OfflineModelConfig = {
    transducer: OfflineTransducerModelConfig
    tokens: string
    /** `nemo_transducer` for Parakeet. Guessed from the files when absent, and wrongly. */
    modelType: string
    numThreads?: number
    provider?: string
    debug?: boolean
  }

  export type OfflineRecognizerConfig = {
    featConfig?: { sampleRate: number; featureDim: number }
    modelConfig: OfflineModelConfig
    decodingMethod?: string
  }

  /**
   * What one decode produced. `lang` is filled by models that detect a language — Parakeet v3
   * does; it takes no language as input, so this is a report and never an instruction.
   */
  export type OfflineRecognizerResult = {
    text: string
    lang?: string
    tokens?: string[]
    timestamps?: number[]
  }

  export class OfflineStream {
    acceptWaveform(data: { samples: Float32Array; sampleRate: number }): void
  }

  export class OfflineRecognizer {
    constructor(config: OfflineRecognizerConfig)
    /**
     * Builds the recogniser off the calling thread. Reading 640 MB of weights blocks whoever
     * does it, and even in a process of its own that would stall the messages coming in.
     */
    static createAsync(config: OfflineRecognizerConfig): Promise<OfflineRecognizer>
    createStream(): OfflineStream
    /** Decodes on the addon's thread pool, leaving this one free to keep taking audio. */
    decodeAsync(stream: OfflineStream): Promise<OfflineRecognizerResult>
  }

  const sherpa: {
    Vad: typeof Vad
    OfflineRecognizer: typeof OfflineRecognizer
  }

  export default sherpa
}
