import { Button } from './Button'
import { UiIcon } from './UiIcon'

export type EmptyStateProps = {
  icon: string
  message: string
  /** The way out, for a panel whose emptiness the user can act on. */
  action?: { label: string; onClick: () => void }
}

/**
 * Message for a panel with no content. An unexplained empty dock reads as a bug.
 *
 * The action is a label and a callback rather than a free node: every panel offers its way out
 * the same way, and a node would let each one grow its own button.
 */
export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <UiIcon path={icon} size={32} className="text-muted/40" />
      <p className="text-muted max-w-56 text-[12px] leading-relaxed">{message}</p>

      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  )
}
