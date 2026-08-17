import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { windowControl } from '../window-styles'

export type WindowNavItemProps = {
  /** The one the pane is showing. Said as `aria-current`, which is what a column answers to. */
  active: boolean
  /**
   * What picking it does, already translated. The entry's own words are on screen, so the
   * sentence explains instead of repeating — and no `aria-label` is set over it (WCAG SC 2.5.3).
   */
  hint: string
  onSelect: () => void
  /**
   * How deep in a tree of sections; `undefined` for a flat list, which is what leaves such a
   * list its own left padding. A number rather than a padding string: the indent is a gauge, and
   * a caller writing pixels would be right at exactly one density.
   */
  depth?: number
  /** The room the entry keeps around its words — each window spaces its column its own way. */
  className?: string
  /**
   * The entries under this one, where the column is a tree. It goes through the entry rather than
   * beside it because HTML says so: a list nested in a list belongs INSIDE the item it hangs from,
   * and a reader walking a column otherwise counts a level the sections do not have.
   */
  nested?: ReactNode
  children: ReactNode
}

/**
 * One entry of that list. The shape was written three times — settings sections, usage sections,
 * manual chapters — each with the same `li`, the same button, and the same two classes over
 * `windowControl`. What genuinely differed was the spacing, which stays with the caller.
 *
 * The hint opens rightwards and no prop says otherwise, unlike the chips of these same windows:
 * a chip sits wherever its row was put, whereas this list IS the column, always against the left
 * edge. A placement prop here would be a question every caller answers the same way.
 */
export function WindowNavItem({
  active,
  hint,
  onSelect,
  depth,
  className,
  nested,
  children,
}: WindowNavItemProps) {
  return (
    <li>
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        {...HINT_RIGHT(hint)}
        onClick={onSelect}
        style={
          depth === undefined ? undefined : { paddingLeft: `calc(var(--sc-indent) * ${depth + 1})` }
        }
        className={cn(windowControl(active), 'w-full text-left', className)}
      >
        {children}
      </button>

      {nested}
    </li>
  )
}
