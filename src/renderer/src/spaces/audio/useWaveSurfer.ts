import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import { playbackToken } from '@/engines/timeline/playback'
import { durationOf } from '@/engines/audio/audio-data'
import type { RenderedAudio } from '@/engines/audio/audio-render'
import type { Region } from '@/engines/audio/edits'
import { SECOND, type Us } from '@/engines/timeline/timeline-state'

export type WaveSurferHandle = {
  playing: boolean
  currentTime: Us
  toggle: () => void
}

export type UseWaveSurferOptions = {
  /**
   * The surface to draw on — the ELEMENT, not a ref holding it. The host only mounts it once a
   * take is loaded, so it is null on the first render of every path in; a ref would not run
   * this hook's effects again when it finally arrives, and nothing would ever be drawn.
   */
  container: HTMLDivElement | null
  /** The take to draw and play, already encoded. Null while it is still being rendered. */
  rendered: RenderedAudio | null
  /** Identifies this player to the single playback token — the document id does. */
  owner: string
  onRegionChange: (region: Region | null) => void
}

/** Bars rather than a continuous line: fewer paths per redraw, and easier to read at a glance. */
const BAR_WIDTH = 2
const BAR_GAP = 1
const BAR_RADIUS = 2

/**
 * Wavesurfer, driven from the edit chain rather than from the file on disk.
 *
 * The peaks are handed over ready-made, so drawing costs no decode; the audible side comes
 * from a blob of the rendered chain, which is what the editor is for — the file on disk is the
 * take before any of it.
 *
 * It also takes the playback token like every other player (spec § 8.7), which is what stops
 * the programme monitor and this editor from being audible at the same time.
 */
export function useWaveSurfer({
  container,
  rendered,
  owner,
  onRegionChange,
}: UseWaveSurferOptions): WaveSurferHandle {
  const surfer = useRef<WaveSurfer | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState<Us>(0)

  // Kept in a ref so the listeners below never have to be re-subscribed when the callback
  // identity changes — a re-subscription mid-drag drops the region being drawn.
  const notify = useRef(onRegionChange)
  useEffect(() => {
    notify.current = onRegionChange
  }, [onRegionChange])

  // Created once per container. Kept out of the data effect below on purpose: rebuilding the
  // instance on every edit would destroy the very region the pointer is dragging.
  useEffect(() => {
    if (!container) return

    const plugin = RegionsPlugin.create()
    const instance = WaveSurfer.create({
      container,
      barWidth: BAR_WIDTH,
      barGap: BAR_GAP,
      barRadius: BAR_RADIUS,
      height: 'auto',
      plugins: [plugin],
    })

    surfer.current = instance
    plugin.enableDragSelection({})

    instance.on('play', () => setPlaying(true))
    instance.on('pause', () => setPlaying(false))
    instance.on('timeupdate', seconds => setCurrentTime(Math.round(seconds * SECOND)))

    // One region at a time: the toolbar acts on "the selection", and two of them would leave
    // it ambiguous which.
    const only = (region: { start: number; end: number; remove: () => void }): void => {
      for (const other of plugin.getRegions()) if (other !== region) other.remove()
      notify.current({
        from: Math.round(region.start * SECOND),
        to: Math.round(region.end * SECOND),
      })
    }
    plugin.on('region-created', only)
    plugin.on('region-updated', only)

    return () => {
      playbackToken.release(owner)
      instance.destroy()
      surfer.current = null
      setPlaying(false)
    }
  }, [container, owner])

  /**
   * The take itself, pushed in as a blob AND as peaks.
   *
   * The blob is what makes it audible: handed peaks and a duration alone, wavesurfer renders
   * the waveform and plays nothing at all — there is no media behind it. The peaks ride along
   * so the drawing still costs no second decode.
   *
   * It has to be a blob rather than the asset's own URL, because what is heard is the edit
   * chain and not the file on disk. The WAV arrives already encoded, from the worker that
   * replayed the chain: encoding it here would put 206 ms back on the window's thread.
   */
  // `container` is in the deps though nothing here reads it, and it is load-bearing: it is what
  // stands for the INSTANCE, which a ref cannot announce. A surface replaced — a panel
  // reattached — builds a new instance holding nothing, and the take has to go back into it.
  // The effect above runs first, being declared first, so the ref is already the fresh one.
  useEffect(() => {
    const instance = surfer.current
    if (!instance || !rendered) return

    const blob = new Blob([rendered.wav], { type: 'audio/wav' })
    instance
      .loadBlob(blob, rendered.data.channels, durationOf(rendered.data) / SECOND)
      .catch(() => {
        // Rejects when the take is swapped mid-load, which is not a failure worth reporting.
      })
  }, [container, rendered])

  return {
    playing,
    currentTime,

    toggle: () => {
      const instance = surfer.current
      if (!instance) return

      if (instance.isPlaying()) {
        instance.pause()
        return
      }

      // Taking the token revokes whoever held it: two audible streams is the bug this prevents.
      playbackToken.acquire(owner, () => instance.pause())
      void instance.play()
    },
  }
}
