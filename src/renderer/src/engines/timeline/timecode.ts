import { frameDuration, type Us } from '@shared/domain/time'

const pad = (value: number): string => String(value).padStart(2, '0')

/**
 * `HH:MM:SS:FF`, the only notation an edit is read in — seconds with decimals say nothing about
 * which frame is showing.
 *
 * Takes the rate rather than a sequence's settings: a scene's animation has a rate and none of
 * the other three, and reads its own band in the same notation.
 */
export function formatTimecode(time: Us, fps: number): string {
  const frames = Math.max(0, Math.round(time / frameDuration(fps)))
  const rate = Math.round(fps)

  return [
    pad(Math.floor(frames / (rate * 3_600))),
    pad(Math.floor(frames / (rate * 60)) % 60),
    pad(Math.floor(frames / rate) % 60),
    pad(frames % rate),
  ].join(':')
}

/**
 * `MM:SS.cc`, for sound and for anything read outside a sequence. There is no frame grid to
 * count against there, and hundredths are what a fade or a silence is judged in.
 */
export function formatDuration(time: Us): string {
  const hundredths = Math.max(0, Math.round(time / 10_000))
  const seconds = Math.floor(hundredths / 100)

  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}.${pad(hundredths % 100)}`
}
