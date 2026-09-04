import { createReadStream, createWriteStream } from 'node:fs'
import { open, stat, unlink } from 'node:fs/promises'
import { Transform, type TransformCallback } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { steppedProgress, type TaskWatch } from '@shared/domain/taskProgress'
import { orElse } from '@shared/promises'

export async function removeExternalCopy(path: string): Promise<void> {
  await orElse(unlink(path), undefined)
}

export async function copyExternalFile(
  source: string,
  destination: string,
  { onStep, signal }: TaskWatch,
): Promise<boolean> {
  if (signal?.aborted) return false
  const total = (await stat(source)).size
  if (signal?.aborted) return false
  const progress = steppedProgress(total, onStep)
  const meter = new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
      progress(chunk.length)
      callback(null, chunk)
    },
  })
  const destinationHandle = await open(destination, 'wx')

  try {
    await pipeline(
      createReadStream(source),
      meter,
      createWriteStream(destination, { fd: destinationHandle.fd, autoClose: false }),
      { signal },
    )
    await destinationHandle.close()
    return true
  } catch (error) {
    await orElse(destinationHandle.close(), undefined)
    await removeExternalCopy(destination)
    if (signal?.aborted) return false
    throw error
  }
}
