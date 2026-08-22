export type DecodeWorkerRequest =
  | { kind: 'decode'; id: number; bytes: ArrayBuffer }
  | { kind: 'peaks'; id: number; bytes: ArrayBuffer; perSecond: number }

export type DecodeWorkerResponse =
  | { kind: 'decoded'; id: number; sampleRate: number; channels: Float32Array[] }
  | { kind: 'peaked'; id: number; peaks: Float32Array }
  | { kind: 'failed'; id: number; message: string }
