import { mdiCheck } from '@mdi/js'
import { cn } from '@/helpers/cn'
import { UiIcon } from './UiIcon'

export type MenuRowProps = {
  /** Already translated: the row draws what it is handed and looks nothing up. */
  label: string
  icon: string
  shortcut?: string
  disabled?: boolean
  /** Ticked when this row is the one currently armed. */
  checked?: boolean
  /** Tooltip attributes from the host's factory, already resolved. */
  tip?: Record<string, string>
  onSelect: () => void
}

/**
 * One row of a flyout menu, wherever the flyout hangs from — the toolbar's mode groups, a panel
 * title bar's add button. Written once so a row keeps one height, one tick column and one
 * disabled look across all of them.
 */
export function MenuRow({ label, icon, shortcut, disabled, checked, tip, onSelect }: MenuRowProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      {...tip}
      className={cn(
        // The tick marks what is armed; the accent marks what the pointer is on. Two
        // different questions, and colouring the armed row would answer neither.
        'group text-text hover:bg-accent flex cursor-pointer items-center hover:text-white',
        'h-(--sc-control) gap-2 rounded-(--radius-sc-md) border-none bg-transparent px-2',
        'text-left text-[11px] transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        'disabled:hover:text-text',
      )}
      onClick={onSelect}
    >
      {/* The tick keeps its column even when absent: rows whose labels shift left by a glyph
          are unreadable as a list. */}
      <span className="flex w-3.5 shrink-0 justify-center">
        {checked && <UiIcon path={mdiCheck} size={12} />}
      </span>
      <UiIcon path={icon} size={14} />
      <span className="flex-1 truncate">{label}</span>
      {shortcut && (
        <span className="text-muted shrink-0 pl-3 text-[10px] group-hover:text-white">
          {shortcut}
        </span>
      )}
    </button>
  )
}
