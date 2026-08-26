import FilmEncodeWorker from './filmEncode.worker?worker'
import { createWorkerSession } from '../core/workerSession'
import type { FilmEncodeRequest, FilmEncodeResponse } from './filmEncodeMessage'

const session = createWorkerSession<FilmEncodeRequest, FilmEncodeResponse>(
  () => new FilmEncodeWorker(),
)

/** Flip + PNG encode off the window's thread. The GL readback still happens here. */
export async function encodeFilmFrameOffThread(
  pixels: Uint8Array,
  width: number,
  height: number,
  encoded = false,
): Promise<Uint8Array> {
  const id = session.nextId()
  const copy = pixels.slice()
  const answer = await session.send(
    { id, pixels: copy, width, height, encoded } satisfies FilmEncodeRequest,
    [copy.buffer],
  )
  if ('failure' in answer) throw new Error(answer.failure)
  return answer.bytes
}
