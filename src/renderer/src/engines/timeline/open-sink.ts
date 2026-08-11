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

/** The three the choice below is made of, so that choice can be tested without a decoder. */
export type SinkSources = {
  read: (assetId: string) => Promise<Blob>
  /** `null` when the bytes carry no video track, and when they are no container at all. */
  openVideo: (blob: Blob) => Promise<SinkLike | null>
  openPicture: (blob: Blob) => Promise<StillPicture>
}

/**
 * The same frame at every position. A still has no timeline of its own, and `seek` asks for
 * whatever sits under the playhead — so every second answers the one picture there is.
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
 */
export async function openSink(assetId: string, sources: SinkSources): Promise<SinkLike> {
  const blob = await sources.read(assetId)
  return (await sources.openVideo(blob)) ?? createStillSink(await sources.openPicture(blob))
}

async function openVideo(blob: Blob): Promise<SinkLike | null> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) })

  // Rejects for anything that is no container it reads — a picture above all — and answers null
  // for a container holding none, a sound file above all. Both are the still sink's business.
  const track = await input.getPrimaryVideoTrack().catch(() => null)
  if (!track) {
    input.dispose()
    return null
  }

  const sink = new VideoSampleSink(track)
  return { getSample: seconds => sink.getSample(seconds), close: () => input.dispose() }
}

async function openPicture(blob: Blob): Promise<StillPicture> {
  const bitmap = await createImageBitmap(blob)
  return { frame: () => new VideoFrame(bitmap, { timestamp: 0 }), close: () => bitmap.close() }
}

/** What the window runs on: the bytes over the scheme, mediabunny, and the image decoder. */
const browserSources: SinkSources = {
  read: async assetId => (await fetchAsset(assetId)).blob(),
  openVideo,
  openPicture,
}

/** What a monitor hands the engine: the choice above, over the sources the window has. */
export function openAssetSink(assetId: string): Promise<SinkLike> {
  return openSink(assetId, browserSources)
}
