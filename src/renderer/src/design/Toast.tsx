import { mdiClose } from '@mdi/js'
import type { ReactNode } from 'react'
import { ToolButton } from './ToolButton'
import { UiIcon } from './UiIcon'
import { MENU_SURFACE, TONE_TEXT, type StatusTone } from './styles'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'

export type ToastStackProps = { children: ReactNode }

/**
 * Where the studio's notices hang: above the docks, out of the way of the status line, which is
 * where the count lives.
 *
 * It lets the pointer through and each toast takes it back, so the empty room under a single
 * notice — most of a column eighty wide — does not swallow clicks meant for the document.
 */
export function ToastStack({ children }: ToastStackProps) {
  return (
    <div
      className="pointer-events-none fixed right-3 bottom-9 z-50 flex w-80 flex-col gap-1.5"
      role="status"
      aria-live="polite"
    >
      {children}
    </div>
  )
}

export type ToastProps = {
  icon: string
  /** What KIND of notice this is; the ink that says so stays here, as every tone of the studio. */
  tone: StatusTone
  children: ReactNode
  /** Already translated, as every design factory takes it. */
  dismissLabel: string
  dismissHint?: string
  onDismiss: () => void
}

/**
 * One notice, wearing the surface a menu wears minus its layout — one floating look, wherever it
 * hangs. Two things raise one: a failure of the journal, and what became of a spoken sentence.
 *
 * Written on the design system rather than on a toast library: a toast is a floating panel of
 * this studio, and a library would bring its own surface, its own radius and its own animation
 * to fight the tokens with — the same reason a dock never holds a DaisyUI control.
 */
export function Toast({ icon, tone, children, dismissLabel, dismissHint, onDismiss }: ToastProps) {
  return (
    <div className={cn(MENU_SURFACE, 'pointer-events-auto static flex-row items-start gap-2 p-2')}>
      <UiIcon path={icon} size={14} className={cn('mt-px shrink-0', TONE_TEXT[tone])} />

      {children}

      <ToolButton
        icon={mdiClose}
        label={dismissLabel}
        description={dismissHint}
        tooltip={TIP_LEFT}
        variant="header"
        onClick={onDismiss}
      />
    </div>
  )
}
