import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ToolId } from '@shared/domain/tool'
import { Collection } from '@/design/Collection/Collection'
import { EmptyState } from '@/design/EmptyState'
import { TILES_ONLY } from '@/helpers/collectionState'
import { toolIcon, toolTitleKey } from '@/helpers/toolRegistry'
import type { ShelfState } from '@/hooks/useShelf'
import { RefusedPanel } from './RefusedPanel'

/**
 * A panel that is a grid of pictures and nothing else: the library an API key opens onto.
 *
 * The frame was written twice, line for line — the refusal, the grid, the empty state, the name
 * announced to a screen reader. Four panels shared it; the Library is the last one left, the other
 * three having gone with the home's readings of the studio on 13 August. Kept generic rather than
 * folded back in: what differs between callers is the read behind it and the tile it draws, and a
 * shelf that took over the read would have to know about accounts and a cloud page.
 *
 * `tool` rather than an icon and a title: `RefusedPanel` already takes the glyph from the rail's
 * own table, and a panel whose empty state wears a different icon from its rail button is the
 * drift that choice exists to prevent.
 */
export function ShelfPanel<T extends { id: string }>({
  tool,
  items,
  state,
  onRetry,
  renderCard,
  empty,
  refused,
}: {
  tool: ToolId
  items: readonly T[]
  state: ShelfState
  onRetry: () => void
  renderCard: (item: T) => ReactNode
  /** Already translated: what this panel says when the read came back with nothing. */
  empty: string
  /** Already translated, and optional: which read failed, when the panel knows better than
   * the generic line — one that reads two channels can name the one that answers for both. */
  refused?: string
}) {
  const { t } = useTranslation()

  // A refusal is the one state worth offering to try again — `ready` covers "nothing to show".
  if (state === 'refused') return <RefusedPanel tool={tool} message={refused} onRetry={onRetry} />

  return (
    <Collection
      label={t(toolTitleKey(tool))}
      items={items}
      state={TILES_ONLY}
      // The click belongs to the tile rather than the cell, in every one of them: `onOpen` would name
      // the cell, and a reader would hear the verb instead of "listitem". Two grids of the same
      // tile must not answer differently.
      renderCard={renderCard}
      empty={<EmptyState icon={toolIcon(tool)} message={empty} />}
    />
  )
}
