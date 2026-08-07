import { useEffect, useRef, useState, type RefObject } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import { playbackToken } from '@/engines/timeline/playback'
import type { AudioData } from '@/engines/audio/audio-data'
import { durationOf } from '@/engines/audio/audio-data'
import type { Region } from '@/engines/audio/edits'
import { SECOND, type Us } from '@/engines/timeline/timeline-state'

export type WaveSurferHandle = {
  playing: boolean
  currentTime: Us
  toggle: () => void
}

export type UseWaveSurferOptions = {
  container: RefObject<HTMLDivElement | null>
  /** The take to draw and play. Null while the asset is still being decoded. */
  data: AudioData | null
  /** Identifies this player to the single playback token — the document id does. */
  owner: string
  onRegionChange: (region: Region | null) => void
}

/** Bars rather than a continuous line: fewer paths per redraw, and easier to read at a glance. */
const BAR_WIDTH = 2
const BAR_GAP = 1
const BAR_RADIUS = 2

/**
 * Wavesurfer, driven from the edit chain rather than from a URL.
 *
 * It is handed the rendered samples directly — `peaks` plus `duration` — so it never decodes
 * anything: the studio has already done that, and asking the library to fetch the file again
 * would mean two copies of a seventy-megabyte take in memory.
 *
 * It also takes the playback token like every other player (spec § 8.7), which is what stops
 * the programme monitor and this editor from being audible at the same time.
 */
export function useWaveSurfer({
  container,
  data,
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
    const element = container.current
    if (!element) return

    const plugin = RegionsPlugin.create()
    const instance = WaveSurfer.create({
      container: element,
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

  // The take itself, pushed in. `setOptions` redraws the bars without touching the instance,
  // its listeners or the region being drawn.
  useEffect(() => {
    if (!data) return
    surfer.current?.setOptions({ peaks: data.channels, duration: durationOf(data) / SECOND })
  }, [data])

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
