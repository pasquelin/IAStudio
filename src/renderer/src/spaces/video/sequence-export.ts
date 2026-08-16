import { frameTimes } from '@/engines/scene/film'
import { createStudioSink } from '@/engines/timeline/sink-port'
import { sequenceDuration, type SequenceState } from '@/engines/timeline/timeline-state'
import { TimelineEngine } from '@/engines/timeline/TimelineEngine'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { assetsById, useAssets } from '@/stores/assets'
import { loadSceneSource, montageSceneOf, montageViewOf } from '@/stores/scene-sources'
import { silentSound } from './silent-sound'

/**
 * Off the page, exactly as a scene stage is: an export renders at the sequence's own resolution,
 * which has nothing to do with the size of the panel someone happens to be watching.
 */
const OFF_SCREEN = '-20000px'

/**
 * How many decoders and pictures an export may hold. The same ceilings a monitor lives under —
 * a GPU offers two to four hardware decoders whether a person is watching or not.
 */
const MAX_DECODERS = 2
const MAX_PICTURES = 4

/** Reported per frame, so a caller can show how far along a render is. */
export type ExportProgress = { frame: number; total: number }

export type SequenceExportOptions = {
  sequence: SequenceState
  /** Names the file the save dialog opens on — the document's own title. */
  title: string
  onProgress?: (progress: ExportProgress) => void
  signal?: AbortSignal
}

/**
 * Writes the montage out as a video file, frame by frame.
 *
 * Composited by the WINDOW rather than by ffmpeg: a montage holds decoded rushes, still pictures
 * and live 3D scenes, and only the engine that plays them knows how to lay them over one
 * another. What crosses to the main process is finished frames, exactly as a scene render does —
 * and it is the same three-step session behind it, so a dismissed dialog costs nothing.
 *
 * The sound is NOT in it yet: `render.finish` assembles pictures alone. A montage exported with
 * music on its tracks comes out silent, and that is a gap, not a decision.
 *
 * Answers the file name, or `null` when the dialog was dismissed or the export was stopped.
 */
export async function exportSequence({
  sequence,
  title,
  onProgress,
  signal,
}: SequenceExportOptions): Promise<string | null> {
  const bridge = getBridge()
  const duration = sequenceDuration(sequence)
  if (!bridge || duration <= 0) return null

  const { fps, width, height } = sequence.settings
  // Asked BEFORE anything is composed, like every render here: an export is minutes of work,
  // and asking where it goes at the end is how one throws it away by pressing Escape.
  const id = await bridge.render.start({ name: title, fps })
  if (!id) return null

  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = OFF_SCREEN
  host.style.top = '0'
  host.style.width = `${width}px`
  host.style.height = `${height}px`
  host.style.pointerEvents = 'none'
  document.body.appendChild(host)

  const engine = new TimelineEngine({
    openSink: createStudioSink({
      sceneOf: montageSceneOf,
      wantScene: loadSceneSource,
      viewOf: montageViewOf,
      assetOf: assetId => assetsById(useAssets.getState()).get(assetId) ?? null,
      size: () => ({ width, height }),
    }),
    // Nothing is listened to here, and an export that woke the audio output would talk over
    // whatever the studio is playing.
    sound: silentSound(),
    maxDecoders: MAX_DECODERS,
    maxPictures: MAX_PICTURES,
    owner: `export:${title}`,
  })

  try {
    await engine.mount(host)
    engine.apply(sequence)

    const times = frameTimes(duration, fps)
    let index = 0
    for (const time of times) {
      if (signal?.aborted) {
        await bridge.render.cancel(id)
        return null
      }

      // Awaited one at a time: `seek` opens whatever decoder that instant needs, and running
      // ahead of it would hold the whole film in memory for no gain.
      await engine.seek(time)
      const png = await engine.snapshot()
      if (!png) continue

      index += 1
      await bridge.render.frame({ id, index, png })
      onProgress?.({ frame: index, total: times.length })
    }

    return await bridge.render.finish(id)
  } catch (error) {
    await bridge.render.cancel(id)
    reportFailure('sequence.export', title, error)
    return null
  } finally {
    engine.dispose()
    host.remove()
  }
}
