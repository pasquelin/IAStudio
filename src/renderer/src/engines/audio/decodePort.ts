import DecodeWorker from './decode.worker?worker'
import { createWorkerSession } from '../core/workerSession'
import type { AudioData } from './audioData'
import type { DecodeWorkerRequest, DecodeWorkerResponse } from './decodeMessage'

const session = createWorkerSession<DecodeWorkerRequest, DecodeWorkerResponse>(
  () => new DecodeWorker(),
)

export async function decodeBytesOffThread(bytes: ArrayBuffer): Promise<AudioData> {
  const id = session.nextId()
  const answer = await session.send({ kind: 'decode', id, bytes }, [bytes])
  if (answer.kind !== 'decoded')
    throw new Error(answer.kind === 'failed' ? answer.message : 'decode failed')
  return { sampleRate: answer.sampleRate, channels: answer.channels }
}

export async function peaksFromBytesOffThread(
  bytes: ArrayBuffer,
  perSecond: number,
): Promise<Float32Array> {
  const id = session.nextId()
  const answer = await session.send({ kind: 'peaks', id, bytes, perSecond }, [bytes])
  if (answer.kind !== 'peaked')
    throw new Error(answer.kind === 'failed' ? answer.message : 'peaks failed')
  return answer.peaks
}
