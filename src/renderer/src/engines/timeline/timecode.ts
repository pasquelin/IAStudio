import { frameDuration, type SequenceSettings, type Us } from './timeline-state'

const pad = (value: number): string => String(value).padStart(2, '0')

/**
 * `HH:MM:SS:FF`, the only notation an edit is read in — seconds with decimals say nothing about
 * which frame is showing.
 */
export function formatTimecode(time: Us, settings: SequenceSettings): string {
  const frames = Math.max(0, Math.round(time / frameDuration(settings)))
  const fps = Math.round(settings.fps)

  return [
    pad(Math.floor(frames / (fps * 3_600))),
    pad(Math.floor(frames / (fps * 60)) % 60),
    pad(Math.floor(frames / fps) % 60),
    pad(frames % fps),
  ].join(':')
}
