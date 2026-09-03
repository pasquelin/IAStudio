import { Fragment, type ReactNode } from 'react'
import type { VirtualItem, Virtualizer } from '@tanstack/react-virtual'
import { cn } from '@/helpers/cn'
import type { Modifiers } from '@/helpers/selection'
import { GAP } from '../virtual'
import { RowChevron } from '../RowChevron'
import { CollectionCell } from './CollectionCell'

type CollectionVirtualRowProps<T extends { id: string }> = {
  row: VirtualItem
  items: readonly T[]
  columns: number
  rowPixels: number
  openable: boolean
  grid: boolean
  virtualizer: Virtualizer<HTMLDivElement, Element>
  selected: ReadonlySet<string>
  isDisabled?: (item: T) => boolean
  tabStop: number
  role?: 'option' | 'listitem'
  pick?: (item: T, modifiers: Modifiers) => void
  onOpen?: (item: T) => void
  onActivate?: (item: T) => void
  onContextMenu?: (item: T) => void
  onCellKeyDown: (index: number, event: KeyboardEvent) => void
  expandedId?: string | null
  canOpen?: (item: T) => boolean
  onToggleRow?: (item: T) => void
  renderCard?: (item: T) => ReactNode
  renderRow?: (item: T) => ReactNode
  renderRowDetail?: (item: T) => ReactNode
}

export function CollectionVirtualRow<T extends { id: string }>(
  props: CollectionVirtualRowProps<T>,
) {
  const { row, items, columns, rowPixels, openable, grid, virtualizer, selected, tabStop } = props
  const slice = items.slice(row.index * columns, (row.index + 1) * columns)
  return (
    <div
      role="presentation"
      data-index={row.index}
      ref={openable ? virtualizer.measureElement : undefined}
      style={{
        transform: `translateY(${row.start}px)`,
        ['--sc-row-height' as string]: `${rowPixels}px`,
        ...(openable ? {} : { height: row.size }),
        ...(grid
          ? { gap: GAP, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
          : { paddingBottom: 4 }),
      }}
      className={cn(
        'absolute inset-x-0 top-0 box-border',
        grid ? 'grid items-start' : openable ? 'flex flex-col' : 'flex',
      )}
    >
      {slice.map((item, column) => {
        const index = row.index * columns + column
        const expandable = props.canOpen?.(item) ?? true
        const open = openable && item.id === props.expandedId && expandable
        const cell = (
          <CollectionCell
            key={item.id}
            expanded={openable && expandable ? open : undefined}
            index={index}
            selected={selected.has(item.id)}
            disabled={props.isDisabled?.(item) === true}
            tabbable={index === tabStop}
            className={grid ? 'p-1' : cn('h-full w-full px-1', openable && 'flex items-center')}
            role={props.role}
            position={index + 1}
            total={items.length}
            onSelect={
              props.pick
                ? modifiers => props.pick?.(item, modifiers)
                : props.onOpen && (() => props.onOpen?.(item))
            }
            onActivate={props.onActivate ? () => props.onActivate?.(item) : undefined}
            onContextMenu={props.onContextMenu ? () => props.onContextMenu?.(item) : undefined}
            onArrow={event => props.onCellKeyDown(index, event)}
          >
            {openable && (
              <RowChevron
                expandable={expandable}
                expanded={open}
                onToggle={() => props.onToggleRow?.(item)}
              />
            )}
            {props.renderCard ? props.renderCard(item) : props.renderRow?.(item)}
          </CollectionCell>
        )
        if (!openable) return cell
        return (
          <Fragment key={item.id}>
            <div style={{ height: rowPixels }} className="flex shrink-0">
              {cell}
            </div>
            {open && <div data-row-detail>{props.renderRowDetail?.(item)}</div>}
          </Fragment>
        )
      })}
    </div>
  )
}
