import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from 'mediabunny'
import { fetchAsset } from '@/helpers/asset-fetch'
import type { SinkLike } from './decoder-pool'

/**
 * A decoded still, kept open behind the sink.
 *
 * `frame` hands back a new one on every call: whoever draws a frame closes it, and the next
 * seek asks for another — while the picture itself outlives them all.
 */
export type StillPicture = {
  frame: () => VideoFrame
  close: () => void
}

/**
 * What the window can do and jsdom cannot: read over the scheme, demux, decode a picture.
 * Everything above this line is testable, and only the implementation below needs a browser.
 */
export type SinkPort = {
  read: (assetId: string) => Promise<Blob>
  /** `null` for a container carrying no video track; throws for bytes that are no container. */
  openVideo: (blob: Blob) => Promise<SinkLike | null>
  openPicture: (blob: Blob) => Promise<StillPicture>
}

/**
 * The same frame at every position. A still has no timeline of its own, and `seek` asks for
 * whatever sits under the playhead — so every second answers the one picture there is.
 *
 * It costs a texture upload per painted frame for a picture that never changes: `SinkLike` has
 * no way to answer « unchanged », and `null` already means « hide this track ».
 */
export function createStillSink(picture: StillPicture): SinkLike {
  return {
    // The sample closes into nothing: the frame it yields is closed by whoever drew it, and
    // closing the picture here would leave the next seek with nothing to draw.
    getSample: async () => ({ toVideoFrame: picture.frame, close: () => {} }),
    close: picture.close,
  }
}

/**
 * One sink per asset, chosen by what the asset holds.
 *
 * A still is not a decoding failure. Demanding a video track of a picture threw, the pool wrote
 * the asset off as undecodable, and the program monitor stayed black over a clip that was there.
 *
 * Decided on the BYTES, where `isLocalPicture` decides on the catalogue row: a port is handed an
 * id and no catalogue, and giving it one would be handing the engine the store — invariant 4.
 */
export async function openSink(assetId: string, port: SinkPort): Promise<SinkLike> {
  const blob = await port.read(assetId)
  return (await videoSinkOf(blob, port)) ?? createStillSink(await port.openPicture(blob))
}

/**
 * A refusal is not a failure here: a picture is no container, and mediabunny throws on one.
 * `try` rather than `.catch`, which a synchronous throw would sail straight past.
 */
async function videoSinkOf(blob: Blob, port: SinkPort): Promise<SinkLike | null> {
  try {
    return await port.openVideo(blob)
  } catch {
    return null
  }
}

/** Releases the input on every path that does not hand a sink back — it holds the demuxer. */
async function openVideo(blob: Blob): Promise<SinkLike | null> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) })

  try {
    const track = await input.getPrimaryVideoTrack()
    if (track) {
      const sink = new VideoSampleSink(track)
      return { getSample: seconds => sink.getSample(seconds), close: () => input.dispose() }
    }
  } catch (error) {
    input.dispose()
    throw error
  }

  input.dispose()
  return null
}

/** A second reserve of decoded pictures, beside `image-cache`: this one is bounded by the pool. */
async function openPicture(blob: Blob): Promise<StillPicture> {
  const bitmap = await createImageBitmap(blob)
  return { frame: () => new VideoFrame(bitmap, { timestamp: 0 }), close: () => bitmap.close() }
}

/** The browser behind the port: the bytes over the scheme, mediabunny, and the image decoder. */
const browserPort: SinkPort = {
  read: async assetId => (await fetchAsset(assetId)).blob(),
  openVideo,
  openPicture,
}

/** What a monitor hands the engine: the choice above, over the port the window has. */
export function openAssetSink(assetId: string): Promise<SinkLike> {
  return openSink(assetId, browserPort)
}
