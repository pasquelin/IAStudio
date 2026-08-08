/**
 * How long ago something happened, in words — "2 hours ago", "yesterday".
 *
 * A studio's home is read to answer "where was I", and an ISO date makes that a subtraction the
 * reader has to do. Below a minute it says "just now" rather than "0 seconds ago", which is the
 * one case the formatter gets wrong on its own.
 */

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

/** Ordered coarsest last: the first unit the elapsed time reaches is the one that reads best. */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', YEAR],
  ['month', MONTH],
  ['week', WEEK],
  ['day', DAY],
  ['hour', HOUR],
  ['minute', MINUTE],
]

/**
 * One formatter per language, kept — for the same reason `ActivityList` keeps its own: building
 * an `Intl` formatter costs about ten times what using one does, and a shelf formats a date per
 * card on every render.
 */
const FORMATTERS = new Map<string, Intl.RelativeTimeFormat>()

function formatterFor(language: string): Intl.RelativeTimeFormat {
  const held = FORMATTERS.get(language)
  if (held) return held

  const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  FORMATTERS.set(language, formatter)
  return formatter
}

/**
 * `null` for a date that is not one — a hand-edited settings file reaches here, and a card
 * saying "Invalid Date" is worse than a card saying nothing.
 */
export function timeAgo(at: string, language: string, now: number = Date.now()): string | null {
  const stamp = new Date(at).getTime()
  if (Number.isNaN(stamp)) return null

  const elapsed = Math.max(0, Math.round((now - stamp) / 1000))
  const formatter = formatterFor(language)

  for (const [unit, seconds] of UNITS) {
    if (elapsed >= seconds) return formatter.format(-Math.floor(elapsed / seconds), unit)
  }

  // Under a minute. `second` with `numeric: 'auto'` says "now" in English and "maintenant" in
  // French, which is exactly what a project just opened should read as.
  return formatter.format(0, 'second')
}
