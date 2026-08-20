/// <reference lib="webworker" />
/**
 * Wiring only, like `skinWeights.worker.ts`: everything worth reasoning about is in `retarget.ts`,
 * which needs no worker to be measured.
 *
 * What IS here and nowhere else: three's own sampling loop. `retargetClip` replays the source
 * through an `AnimationMixer` frame by frame — 240 whole poses for eight seconds at 30 fps — and
 * that is pure arithmetic with no DOM and no GPU, which is exactly what invariant 6 sends away.
 */
import { retargetClip } from 'three/addons/utils/SkeletonUtils.js'
import type { SkinnedMesh } from 'three'
import { messageOf } from '@shared/guards'
import {
  clipFromWire,
  nodeTrackNameOf,
  skeletonScaleOf,
  skinnedFromWire,
  wireClipOf,
} from './retarget'
import {
  clipBuffers,
  isRetargetCancel,
  type RetargetIncoming,
  type RetargetRequest,
  type RetargetResponse,
  type WireClip,
} from './retargetMessage'

declare const self: DedicatedWorkerGlobalScope

const running = new Set<number>()
const cancelled = new Set<number>()

self.addEventListener('message', (event: MessageEvent<RetargetIncoming>) => {
  const message = event.data
  if (isRetargetCancel(message)) {
    // Only what is still going. A cancellation crossing paths with the answer it meant to stop is
    // the ordinary case, and remembering that id would leave one entry behind for good.
    if (running.has(message.id)) cancelled.add(message.id)
    return
  }
  void run(message)
})

async function run(request: RetargetRequest): Promise<void> {
  running.add(request.id)
  try {
    // Built once for the whole request: rebuilding a skeleton per clip would dominate the work.
    const target = skinnedFromWire(request.target)
    const source = skinnedFromWire(request.source)
    // Measured HERE rather than on the caller's objects, so the size read is the one of the very
    // skeletons three is about to sample — the same space, whatever the scene did to the models.
    const scale = skeletonScaleOf(target, source)
    const adapted: WireClip[] = []

    for (const [index, clip] of request.clips.entries()) {
      if (cancelled.delete(request.id)) return

      adapted.push(adaptOne(request, target, source, clip, scale))
      post({ id: request.id, done: false, progress: (index + 1) / request.clips.length })
      // Yields the queue: without it a cancellation sent mid-request would sit unread until the
      // whole run it was meant to stop had finished.
      await breathe()
    }

    if (cancelled.delete(request.id)) return

    self.postMessage(
      { id: request.id, done: true, ok: true, clips: adapted } satisfies RetargetResponse,
      {
        transfer: clipBuffers(adapted),
      },
    )
  } catch (error) {
    post({ id: request.id, done: true, ok: false, error: messageOf(error) })
  } finally {
    running.delete(request.id)
    cancelled.delete(request.id)
  }
}

function adaptOne(
  request: RetargetRequest,
  target: SkinnedMesh,
  source: SkinnedMesh,
  clip: WireClip,
  scale: number,
): WireClip {
  // A FRESH options object per clip, and that is not tidiness: `retargetClip` WRITES its defaults
  // back into what it is handed, so a shared one would fix every later clip at the first one's
  // sampling rate.
  const sampled = retargetClip(target, source, clipFromWire(clip), {
    names: request.names,
    hip: request.hip,
    fps: request.fps,
    scale,
  })
  const wire = wireClipOf(sampled)

  // `retargetClip` answers a duration of -1, meaning "read it off the tracks"; the wire carries a
  // number, and the source clip is what the sampling covered.
  return {
    ...wire,
    duration: clip.duration,
    tracks: wire.tracks.map(track => ({ ...track, name: nodeTrackNameOf(track.name) })),
  }
}

function post(response: RetargetResponse): void {
  self.postMessage(response)
}

function breathe(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}
