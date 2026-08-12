import { cn } from '@/helpers/cn'

/**
 * Class strings shared by the windows that are NOT docks — Settings and Usage, where the
 * studio becomes an ordinary application and DaisyUI dresses it.
 *
 * Apart from `styles.ts` on purpose: that file says in its first line that it holds what the
 * components of `design/` share, and its strings speak the studio's own tokens. These speak
 * DaisyUI's (`base-content`), and the two vocabularies must not end up in one bag — the
 * boundary between the docks and the app windows is a rule of the project, not a detail.
 */

/** The secondary line of a window: a count, an empty state, a sentence beside a control. */
export const WINDOW_CAPTION = 'text-base-content/70 text-xs'

/**
 * What a control explains about itself, under it. Capped: a help sentence running the whole
 * width of a maximised window is read twice and understood once.
 */
export const WINDOW_HELP = cn(WINDOW_CAPTION, 'max-w-lg')
