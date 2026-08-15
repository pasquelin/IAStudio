import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import TimelinePlugin, { type TimelinePluginOptions } from 'wavesurfer.js/dist/plugins/timeline.js'
import { playbackToken } from '@/engines/timeline/playback'
import { useToken } from '@/hooks/useToken'
import { durationOf } from '@/engines/audio/audio-data'
import type { RenderedAudio } from '@/engines/audio/audio-render'
import type { Region } from '@/engines/audio/edits'
import { formatDuration } from '@/engines/timeline/timecode'
import { RULER_HEIGHT } from '@/engines/timeline/timeline-geometry'
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

/** Wide enough to read as a line against the veil the selection is tinted with, and no wider. */
const CURSOR_WIDTH = 2

/**
 * The graduations above the wave — where the strip and the programme monitor both wear
 * `paintRuler`, this one is wavesurfer's own plugin, the take being drawn by wavesurfer.
 *
 * `RULER_HEIGHT` is the strip's, so the three rulers of an Audio tab stand the same height. Its
 * INK is not set here: the wrapper carries `part="timeline-wrapper"`, so `index.css` dresses it
 * the way it already dresses the region handles — which is what keeps a theme switched with the
 * editor open from leaving this one surface behind, and the values where they belong.
 *
 * Labels through `formatDuration`, the one the editor's own bar announces a selection with. The
 * strip reads timecode in frames; a take has no frame grid of its own to read against.
 */
const TIMELINE: TimelinePluginOptions = {
  height: RULER_HEIGHT,
  insertPosition: 'beforebegin',
  // One label per graduation. The plugin's own default is one every TEN, which on a generated
  // take — five seconds, thirty at most — put a single "00:00.00" at the far left and nothing
  // after it. The graduation itself already adapts to the width, so following it adapts too:
  // a second apart on a short take, a minute apart on a long one.
  primaryLabelInterval: 1,
  formatTimeCallback: seconds => formatDuration(Math.round(seconds * SECOND)),
}

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
  const regions = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState<Us>(0)

  /**
   * The two marks of this surface, and they sit on top of one another: the SELECTION a drag lays
   * down, and the head a click moves. Telling them apart is what these tokens are for — the
   * selection is the accent as a veil, an area; the head is the accent at full, a line. The same
   * opposition the strip below already draws between a selected clip and the playhead.
   *
   * Through `useToken` and not read once on mount: a theme switched with the editor open would
   * otherwise leave this the one surface still wearing the palette it was built under.
   */
  const wave = useToken('--color-muted')
  const head = useToken('--color-accent')
  const veil = useToken('--color-accent-veil')

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
      plugins: [plugin, TimelinePlugin.create(TIMELINE)],
    })

    surfer.current = instance
    regions.current = plugin

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
      regions.current = null
      setPlaying(false)
    }
  }, [container, owner])

  /**
   * The palette, laid on the instance rather than handed to its constructor — which is what lets
   * a theme switched with the editor open reach a wave already drawn.
   *
   * The veil is given to the DRAG and not to the region once it lands: what is being traced is
   * drawn as the pointer moves, and a region left to its own default traces it in wavesurfer's
   * black. `enableDragSelection` hands back its own unsubscribe, so re-arming it with the new
   * colour is the effect's cleanup and nothing has to be counted.
   *
   * `container` sits in the deps for the reason the take below carries: it stands for the
   * INSTANCE, and a surface replaced is a fresh one holding none of this.
   */
  useEffect(() => {
    const instance = surfer.current
    const plugin = regions.current
    if (!instance || !plugin) return
    // A token that answers nothing is a stylesheet not parsed yet, and an empty string is not the
    // library's `??` default: it would paint the wave and the selection in nothing at all.
    if (!wave || !head || !veil) return

    // The played part is NOT tinted: a third fill sliding under the veil is what made the
    // selection and the head unreadable against one another in the first place.
    instance.setOptions({
      waveColor: wave,
      progressColor: wave,
      cursorColor: head,
      cursorWidth: CURSOR_WIDTH,
    })
    for (const region of plugin.getRegions()) region.setOptions({ color: veil })

    return plugin.enableDragSelection({ color: veil })
  }, [container, wave, head, veil])

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
