import type { ReactNode } from 'react'
import { TooltipHost } from './TooltipHost'
import { DRAGGABLE } from '@/helpers/appRegion'

export type WindowShellProps = {
  /** Already translated, as every design component takes its words. */
  title: string
  /** What sits at the right of the title bar — a period picker, a filter. Dragged, so a control inside needs `CLICKABLE`. */
  headerActions?: ReactNode
  /** Under everything, across the full width: the settings draft bar and nothing else so far. */
  footer?: ReactNode
  children: ReactNode
} & WindowColumn

/**
 * The column, or none — and the two go together or not at all.
 *
 * Paired rather than two optionals: a `<nav>` with no accessible name is a landmark a screen
 * reader announces as nothing, and independent optionals let one be written without the other.
 *
 * ABSENT is a shape of its own, not an empty column: a window that reads as one block — the
 * file information — would otherwise carry 224 px of nothing down its left edge.
 */
type WindowColumn =
  | {
      /** Names the column for a screen reader. Translated. */
      navLabel: string
      /**
       * The column itself, free-form: one window scrolls its list under a pinned search field,
       * another pins a button under a scrolling one. The shell owns the box, never what fills
       * it — which is what a `navScrolls` flag would have got wrong for both.
       */
      nav: ReactNode
    }
  | { navLabel?: never; nav?: never }

/**
 * The frame of a window that is NOT a dock — a title bar, a column, a pane beside it.
 *
 * Written once because it was written three times. Settings and Usage already carried the same
 * header, the same `w-56` bordered column and the same `min-w-0 flex-1 overflow-auto` pane, and
 * `UsageWindow` said so in its own docstring — "built on the settings window's shape rather than
 * its own". The manual arrived as a third copy, in the STUDIO's tokens rather than DaisyUI's,
 * which is how a window can pass every test and still not look like the application it is in.
 *
 * DaisyUI here, deliberately: these are the surfaces where the studio becomes an ordinary
 * application. The docks speak the other vocabulary, and the two must not end up in one bag —
 * see `windowStyles.ts`, which draws the same boundary for the class strings.
 *
 * `TooltipHost` is mounted here rather than by each window. It is per-window and easy to forget:
 * without it, tooltip attributes write a sentence nobody ever sees.
 */
export function WindowShell({
  title,
  headerActions,
  navLabel,
  nav,
  footer,
  children,
}: WindowShellProps) {
  return (
    <div className="bg-base-200 text-base-content flex h-full flex-col">
      <header
        style={DRAGGABLE}
        className="text-body flex shrink-0 items-center pt-2 pr-4 pb-2 pl-24 font-medium"
      >
        {/* A heading rather than bare words: it is the only thing naming the window to a reader,
            and Tailwind's preflight leaves an `h1` at the size its container gives it. */}
        <h1>{title}</h1>
        {headerActions}
      </header>

      <div className="flex min-h-0 flex-1">
        {nav && (
          <nav
            aria-label={navLabel}
            className="border-base-300 flex w-56 shrink-0 flex-col gap-2 border-r p-2"
          >
            {nav}
          </nav>
        )}

        <main className="min-w-0 flex-1 overflow-auto px-6 py-4">{children}</main>
      </div>

      {footer}
      <TooltipHost />
    </div>
  )
}
