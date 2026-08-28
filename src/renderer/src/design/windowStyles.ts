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

/**
 * The heading over a run of rows — a scope of shortcuts, a section of results, a family of AI
 * employments. Written out three times before it was named, and a fourth spelling read differently.
 */
export const WINDOW_GROUP_LABEL = 'text-base-content/70 text-tiny mb-1 tracking-wide uppercase'

/** A line of a list here: a setting, a search hit, a chapter. The direction stays at the call. */
export const WINDOW_ROW = 'border-base-300 flex gap-2 border-b py-3 last:border-b-0'

/** The same line when the whole of it is the button. */
export const WINDOW_ROW_BUTTON = cn(WINDOW_ROW, 'hover:bg-base-300 w-full text-left')

/**
 * A control of one of these windows: a section of the column, a period, a refresh.
 *
 * One look for all of them, and one definition. Usage held this as a local `control()` while
 * Settings wrote the same two lines inline on its navigation entries — the manual then made a
 * third copy, in the studio's tokens, which is what sent this to `design/`.
 *
 * The height comes from the gauge, never from a number: a control is 24 px in compact and 28 in
 * comfort, and a constant would be right at exactly one density.
 */
export function windowControl(active: boolean): string {
  return cn(
    'flex h-(--sc-control) cursor-pointer items-center rounded-(--radius-sc-sm) border-none text-xs',
    active ? 'bg-primary text-primary-content' : 'hover:bg-base-300 bg-transparent',
  )
}

/**
 * 🛑 The buttons of these windows, by ROLE — the vocabulary a caller picks from, never a class
 * string written by hand. `no-loose-window-button.test.ts` holds every site to one of them.
 *
 * Named after the roles were MEASURED across the window rather than invented: nine spellings for
 * six roles, and two components rendering the same action row had already drifted apart, for no
 * rule anyone could state. Nothing read these strings, so nothing went red.
 *
 * This one is what the row or the section EXISTS for — the commonest by far, and the default.
 */
export const WINDOW_ACTION = 'btn btn-sm btn-primary'

/** Beside a primary one, or on its own where nothing is being urged: cancel, rename, sign out. */
export const WINDOW_ACTION_SECONDARY = 'btn btn-sm btn-ghost'

/**
 * Stops what is RUNNING — an indexing, a scan. Neither urged nor destructive, and it takes the
 * place of the primary it replaces, which is why it is not a ghost.
 */
export const WINDOW_ACTION_QUIET = 'btn btn-sm'

/** What cannot be undone. Outlined rather than filled: this is not what a window is FOR. */
export const WINDOW_ACTION_DANGER = 'btn btn-sm btn-error btn-outline'

/**
 * A glyph alone, at the end of a row — `WindowIconButton` is what wears it, and it carries the
 * tooltip the missing label owes the reader.
 */
export const WINDOW_ICON_ACTION = 'btn btn-ghost btn-xs btn-square'

/**
 * The foot of a `Dialog`, which is the one place these windows go larger: a modal asks a question
 * and its answers are the only thing on screen. Deliberately not `…-sm`.
 */
export const DIALOG_ACTION = 'btn btn-primary'
export const DIALOG_ACTION_SECONDARY = 'btn'
