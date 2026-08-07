import { describe, expect, it } from 'vitest'
import { formatTimecode } from './timecode'
import { DEFAULT_SETTINGS } from './timeline-state'

describe('timecode', () => {
  it('starts at zero', () => {
    expect(formatTimecode(0, DEFAULT_SETTINGS)).toBe('00:00:00:00')
  })

  it('counts frames inside the second', () => {
    expect(formatTimecode(120_000, DEFAULT_SETTINGS)).toBe('00:00:00:03')
  })

  it('rolls the frames over into a second', () => {
    expect(formatTimecode(1_000_000, DEFAULT_SETTINGS)).toBe('00:00:01:00')
  })

  it('rolls seconds into minutes and minutes into hours', () => {
    expect(formatTimecode(3_723_000_000, DEFAULT_SETTINGS)).toBe('01:02:03:00')
  })

  it('follows the frame rate of the sequence, not a fixed one', () => {
    const cinema = { ...DEFAULT_SETTINGS, fps: 24 }
    expect(formatTimecode(1_000_000, cinema)).toBe('00:00:01:00')
    expect(formatTimecode(958_333, cinema)).toBe('00:00:00:23')
  })

  it('never shows a negative time', () => {
    expect(formatTimecode(-1_000_000, DEFAULT_SETTINGS)).toBe('00:00:00:00')
  })
})
