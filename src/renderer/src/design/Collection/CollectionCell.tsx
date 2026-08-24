import type { MouseEvent, ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import type { Modifiers } from '@/helpers/selection'
import { isTyping } from '@/helpers/typing'
import { rowSkin } from '../styles'

export type CollectionCellProps = {
  /** Position in `items`, so the arrows can name the cell they want focused. */
  index: number
  selected: boolean
  /**
   * Listed, reachable, announced — and inert. The handlers are still passed and ignored here
   * rather than withheld by the caller: dropping them would take the cell out of its `listbox`
   * and out of the tab order, and the row would lose the tooltip that says why it is refused.
   */
  disabled: boolean
  /** The collection's single tab stop. Every other cell is reached with the arrows. */
  tabbable: boolean
  /** What this cell is in its container's terms — `rolesFor` decides the pair. */
  role?: 'option' | 'listitem'
  /** Whether this row is open, for a collection whose rows do. `undefined` where none can. */
  expanded?: boolean
  /** Where it sits in the whole collection, which the mounted window cannot say. */
  position: number
  total: number
  onSelect?: (modifiers: Modifiers) => void
  onActivate?: () => void
  onContextMenu?: () => void
  onArrow: (event: KeyboardEvent) => void
  className?: string
  children: ReactNode
}

/**
 * Selection, activation and keyboard reach belong to the collection, not to the cards: a caller
 * that had to wire them itself would wire them differently in each panel.
 */
export function CollectionCell({
  index,
  selected,
  disabled,
  tabbable,
  role,
  expanded,
  position,
  total,
  onSelect,
  onActivate,
  onContextMenu,
  onArrow,
  className,
  children,
}: CollectionCellProps) {
  /**
   * Selection and focus are painted here rather than by the rendered item: a background set
   * inside the cell would sit on top of this one and swallow it. They come from `rowSkin`, which
   * the tree draws its own rows with — the same line must not light up differently depending on
   * which panel it is listed in.
   *
   * `surface: 'row'`, and the tree says the same: a list row does not answer the pointer in this
   * studio. Spelled out rather than left to the default, which happens to agree — what the two
   * surfaces MUST agree on is exactly this, and a reader of either file finds the answer where
   * the skin is asked for.
   */
  const skin = cn('min-w-0', rowSkin(selected, { surface: 'row', disabled }), className)

  /**
   * The same reading `Tree` gives a right-click: one landing in a row's rename field belongs to
   * the native clipboard and spelling menu, which `preventDefault` would keep from ever being
   * asked. Nothing is aimed or selected here — the cell hands over the item it draws, and a
   * menu raised on a row acts on that row.
   */
  const raiseMenu = onContextMenu
    ? (event: MouseEvent): void => {
        if (isTyping(event.target)) return
        event.preventDefault()
        onContextMenu()
      }
    : undefined

  // What the cell answers to is not what puts it in reach: a row that only opens is walked to
  // and pressed like one that only selects.
  if (!onSelect && !onActivate)
    return (
      <div className={skin} data-selected={selected || undefined} onContextMenu={raiseMenu}>
        {children}
      </div>
    )

  return (
    <div
      role={role}
      aria-expanded={expanded}
      aria-posinset={position}
      aria-setsize={total}
      aria-disabled={disabled || undefined}
      // Read by `rowSkin`'s group where the ARIA below cannot be: a `listitem` has no selected
      // state to announce, and the explorer still paints what is open through this skin.
      data-selected={selected || undefined}
      data-cell={index}
      tabIndex={tabbable ? 0 : -1}
      // An option has a selected state; a listitem has none. The explorer paints what is OPEN
      // through the same prop, and announcing that as "selected" would describe a state its
      // rows can neither take nor give up.
      aria-selected={role === 'option' ? selected : undefined}
      onClick={disabled ? undefined : onSelect}
      onDoubleClick={disabled ? undefined : onActivate}
      onContextMenu={raiseMenu}
      onKeyDown={event => {
        // Before the refusal, never after: the arrows walk THROUGH a disabled row. Stopping
        // them there would strand the keyboard on it, since it keeps its place in the list.
        if (event.key !== 'Enter' && event.key !== ' ') return onArrow(event.nativeEvent)
        if (disabled) return

        // Only when the cell itself holds the focus: a control inside the row — the visibility
        // eye — answers the key on its own, and `VisibilityToggle` can stop a click but never
        // a key press. Without this, reaching the eye by keyboard also moved the selection.
        if (event.target !== event.currentTarget) return

        // Enter opens, Space picks. A row that cannot be picked leaves Space to the browser,
        // which scrolls the list: Space moves a selection everywhere else in the studio, and
        // making it open a document — switching workspace with it — is not what it promises.
        if (event.key === 'Enter' && onActivate) {
          event.preventDefault()
          onActivate()
        } else if (onSelect) {
          event.preventDefault()
          onSelect(event)
        }
      }}
      className={cn(skin, !disabled && 'cursor-pointer')}
    >
      {children}
    </div>
  )
}
