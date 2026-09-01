import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { DRAGGABLE } from '@/helpers/appRegion'
import { useWindowState } from '@/hooks/useWindowState'

export type WindowTitleBarProps = {
  /** Already translated, as every design component takes its words. */
  title: string
  /** Beside the title: the unsaved mark, and nothing that takes a click — the bar is dragged. */
  mark?: ReactNode
  /** What sits at the right — a period picker, a filter, a mode. Dragged, so a control inside needs `CLICKABLE`. */
  actions?: ReactNode
}

/**
 * The top of a window that is not a dock: the traffic lights float in it, it drags the window,
 * and it names what the window is on.
 *
 * Apart from `WindowShell` because the skeleton window needs this half and none of the other —
 * no navigation column, no DaisyUI ground under it. Copying the header there instead would have
 * left the two free to drift, and the inset that clears the traffic lights is exactly the kind
 * nobody notices has drifted until a window ships with its title under a button.
 */
export function WindowTitleBar({ title, mark, actions }: WindowTitleBarProps) {
  const { fullScreen } = useWindowState()

  return (
    <header
      style={DRAGGABLE}
      className={cn(
        'text-body grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 pt-2 pb-2 font-medium',
        // The left inset only exists to clear the native traffic lights, and the right one
        // balances it so the title sits on the window's own centre rather than beside the
        // lights. macOS removes them in full screen: without the switch a 96 px gap would remain.
        fullScreen ? 'pr-1.5 pl-1.5' : 'pr-24 pl-24',
      )}
    >
      <div />
      <div className="flex min-w-0 items-center justify-center gap-1.5">
        {/* A heading rather than bare words: it is the only thing naming the window to a reader,
            and Tailwind's preflight leaves an `h1` at the size its container gives it. */}
        <h1 className="min-w-0 truncate">{title}</h1>
        {mark}
      </div>
      {/* Its own end of the row, so a control put here never pushes the title off centre. */}
      <div className="flex min-w-0 items-center justify-end gap-2">{actions}</div>
    </header>
  )
}
