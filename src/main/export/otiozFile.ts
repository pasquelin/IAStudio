import { createReadStream, createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { Zip, ZipPassThrough, strToU8 } from 'fflate'
import {
  OTIOZ_CONTENT_PATH,
  OTIOZ_VERSION,
  OTIOZ_VERSION_PATH,
  type BundledMedium,
} from '@shared/domain/otioz'

/**
 * Writing an OpenTimelineIO bundle, media and all.
 *
 * STREAMED rather than built in memory, which is the whole difference between this and the `.ora`
 * writer next door: a stack of layers is tens of megabytes and a montage is the rushes themselves.
 * `zipSync` would hold every rush in memory at once AND deflate them on the thread that owns every
 * window — invariant 6, at a scale where it is seconds rather than milliseconds.
 */

export type OtiozContents = {
  /** `content.otio`, already serialized by the side that holds the catalogue. */
  content: string
  /** Absolute paths, paired with the entry each takes — `bundleOf` decided the names. */
  media: readonly (BundledMedium & { path: string })[]
}

/**
 * A medium the cut names and the disk does not have.
 *
 * Refused rather than skipped, and this is a decision: a bundle quietly missing a rush opens in
 * the target with a red clip nobody can explain, hours later. The name is in the message so the
 * person knows which one to find.
 */
export class MissingMediumError extends Error {
  constructor(readonly entry: string) {
    super(`this montage points at a file that is not there: ${entry}`)
  }
}

/** Pushed in chunks rather than whole, so one rush never sits in memory beside the others. */
async function pushFile(into: ZipPassThrough, path: string): Promise<void> {
  for await (const chunk of createReadStream(path, { highWaterMark: 1 << 20 })) {
    // `Buffer` IS a `Uint8Array`, and fflate reads it as one — no copy is made here.
    into.push(chunk, false)
  }
  into.push(new Uint8Array(0), true)
}

function storedEntry(zip: Zip, name: string, bytes: Uint8Array): void {
  const entry = new ZipPassThrough(name)
  zip.add(entry)
  entry.push(bytes, true)
}

/**
 * The bundle, written where it was asked for.
 *
 * Everything is `ZipPassThrough` — stored, never deflated. That is what lets a reader play a rush
 * in place without unpacking the bundle first, and it is what the reference implementation writes.
 * Deflating an already-compressed video buys nothing and costs the whole file.
 */
export async function writeOtiozFile(
  path: string,
  { content, media }: OtiozContents,
): Promise<void> {
  // Checked BEFORE the file is opened: a bundle half written then abandoned is worse than one
  // that was never started, and the caller learns which medium is missing rather than a code.
  for (const medium of media) {
    const found = await stat(medium.path).catch(() => null)
    if (!found?.isFile()) throw new MissingMediumError(medium.entry)
  }

  const out = createWriteStream(path)
  const chunks = new Readable({ read: () => {} })

  const zip = new Zip((error, data, final) => {
    if (error) {
      chunks.destroy(error)
      return
    }
    chunks.push(data)
    if (final) chunks.push(null)
  })

  const drained = pipeline(chunks, out)

  storedEntry(zip, OTIOZ_VERSION_PATH, strToU8(OTIOZ_VERSION))
  storedEntry(zip, OTIOZ_CONTENT_PATH, strToU8(content))

  for (const medium of media) {
    const entry = new ZipPassThrough(medium.entry)
    zip.add(entry)
    await pushFile(entry, medium.path)
  }

  zip.end()
  await drained
}
