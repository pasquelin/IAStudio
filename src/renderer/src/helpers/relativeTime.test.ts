import { describe, expect, it } from 'vitest'
import { timeAgo } from './relativeTime'

const NOW = new Date('2026-08-08T12:00:00Z').getTime()

function ago(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString()
}

describe('timeAgo', () => {
  it('reaches for the coarsest unit the elapsed time fills', () => {
    expect(timeAgo(ago(90 * 60), 'en', NOW)).toBe('1 hour ago')
    expect(timeAgo(ago(3 * 24 * 3600), 'en', NOW)).toBe('3 days ago')
    expect(timeAgo(ago(400 * 24 * 3600), 'en', NOW)).toBe('last year')
  })

  it('says "now" rather than "0 seconds ago" for something just done', () => {
    expect(timeAgo(ago(5), 'en', NOW)).toBe('now')
  })

  it('speaks the language it is given', () => {
    expect(timeAgo(ago(2 * 3600), 'fr', NOW)).toBe('il y a 2 heures')
  })

  it('treats a clock that ran backwards as "now" rather than a date in the future', () => {
    expect(timeAgo(new Date(NOW + 10_000).toISOString(), 'en', NOW)).toBe('now')
  })

  it('answers nothing for a date that is not one', () => {
    expect(timeAgo('whenever', 'en', NOW)).toBeNull()
  })
})
