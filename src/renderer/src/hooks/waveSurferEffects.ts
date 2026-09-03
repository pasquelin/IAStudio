import { type MutableRefObject, useEffect } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import TimelinePlugin, { type TimelinePluginOptions } from 'wavesurfer.js/dist/plugins/timeline.js'
import { clamp } from '@shared/numeric'
import { durationOf } from '@/engines/audio/audioData'
import type { RenderedAudio } from '@/engines/audio/audioRender'
import type { Region } from '@/engines/audio/edits'
import { playbackToken } from '@/engines/timeline/playback'
import { MAX_SCALE, ZOOM_STEP } from '@/engines/timeline/viewport'
import { SECOND } from '@/engines/timeline/timelineState'

const BAR_WIDTH = 2
const BAR_GAP = 1
const BAR_RADIUS = 2
const CURSOR_WIDTH = 2
const MAX_PX_PER_SECOND = MAX_SCALE * SECOND

export type WaveSurferRefs = {
  surferRef: MutableRefObject<WaveSurfer | null>
  zoomedRef: MutableRefObject<number>
  regionsRef: MutableRefObject<ReturnType<typeof RegionsPlugin.create> | null>
}

type InstanceOptions = WaveSurferRefs & {
  container: HTMLDivElement | null
  owner: string
  timeline: TimelinePluginOptions
  notify: MutableRefObject<(region: Region | null) => void>
  setPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
}

export function useWaveSurferInstance(options: InstanceOptions): void {
  const { container, owner, timeline, notify, surferRef, regionsRef, setPlaying, setCurrentTime } =
    options
  useEffect(() => {
    if (!container) return
    const plugin = RegionsPlugin.create()
    const instance = WaveSurfer.create({
      container,
      barWidth: BAR_WIDTH,
      barGap: BAR_GAP,
      barRadius: BAR_RADIUS,
      height: 'auto',
      plugins: [plugin, TimelinePlugin.create(timeline)],
    })
    surferRef.current = instance
    regionsRef.current = plugin
    instance.on('play', () => setPlaying(true))
    instance.on('pause', () => setPlaying(false))
    instance.on('timeupdate', seconds => setCurrentTime(Math.round(seconds * SECOND)))
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
      surferRef.current = null
      regionsRef.current = null
      setPlaying(false)
    }
  }, [container, owner, notify, regionsRef, setCurrentTime, setPlaying, surferRef, timeline])
}

type PaletteOptions = Pick<InstanceOptions, 'container' | 'surferRef' | 'regionsRef'> & {
  wave: string
  head: string
  veil: string
}

export function useWaveSurferPalette(options: PaletteOptions): void {
  const { container, wave, head, veil, surferRef, regionsRef } = options
  useEffect(() => {
    const instance = surferRef.current
    const plugin = regionsRef.current
    if (!instance || !plugin || !wave || !head || !veil) return
    instance.setOptions({
      waveColor: wave,
      progressColor: wave,
      cursorColor: head,
      cursorWidth: CURSOR_WIDTH,
    })
    for (const region of plugin.getRegions()) region.setOptions({ color: veil })
    return plugin.enableDragSelection({ color: veil })
  }, [container, wave, head, veil, surferRef, regionsRef])
}

export function useWaveSurferAudio(
  container: HTMLDivElement | null,
  rendered: RenderedAudio | null,
  refs: WaveSurferRefs,
): void {
  const { surferRef, zoomedRef } = refs
  useEffect(() => {
    const instance = surferRef.current
    if (!instance || !rendered) return
    zoomedRef.current = 0
    const blob = new Blob([rendered.wav], { type: 'audio/wav' })
    instance
      .loadBlob(blob, rendered.data.channels, durationOf(rendered.data) / SECOND)
      .catch(() => {})
  }, [container, rendered, surferRef, zoomedRef])
}

export function useWaveSurferWheel(container: HTMLDivElement | null, refs: WaveSurferRefs): void {
  const { surferRef, zoomedRef } = refs
  useEffect(() => {
    if (!container) return
    const onWheel = (event: WheelEvent): void => {
      const instance = surferRef.current
      if (!instance) return
      event.preventDefault()
      if (!event.ctrlKey && !event.metaKey) {
        const along = event.shiftKey ? event.deltaY : event.deltaX || event.deltaY
        instance.setScroll(instance.getScroll() + along)
        return
      }
      const duration = instance.getDuration()
      if (duration <= 0) return
      const fitted = Math.min(instance.getWidth() / duration, MAX_PX_PER_SECOND)
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      zoomedRef.current = clamp((zoomedRef.current || fitted) * factor, fitted, MAX_PX_PER_SECOND)
      instance.zoom(zoomedRef.current)
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [container, surferRef, zoomedRef])
}
