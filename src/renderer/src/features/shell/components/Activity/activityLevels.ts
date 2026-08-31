import { mdiAlertCircleOutline, mdiAlertOutline, mdiCheckCircleOutline } from '@mdi/js'
import type { ActivityLevel } from '@shared/domain/activity'
import type { StatusTone } from '@/components/styles'

export const GLYPHS: Record<ActivityLevel, string> = {
  info: mdiCheckCircleOutline,
  warn: mdiAlertOutline,
  error: mdiAlertCircleOutline,
}

/**
 * Shared with the toasts, which stopped holding failures alone: a warning that paints itself red
 * says the studio broke where it meant to say the studio is about to do something surprising.
 *
 * The SENSE, never the ink — `TONE_TEXT` holds the colour, as it does for every status of the
 * studio. A second table of shades here is a second place for `danger` to drift.
 */
export const TONES: Record<ActivityLevel, StatusTone> = {
  info: 'muted',
  warn: 'warning',
  error: 'danger',
}
