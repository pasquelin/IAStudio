import {
  mdiAccountCheckOutline,
  mdiFormatText,
  mdiImageOutline,
  mdiLayersTripleOutline,
  mdiNoteOutline,
} from '@mdi/js'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useReactFlow } from '@xyflow/react'
import type { GraphPosition } from '@shared/domain/graph'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { Separator } from '@/design/Separator'
import type { CreatableNodeType } from '@/engines/graph/factory'
import { PALETTE, paletteLabelKey, type PaletteEntry } from './palette'

/**
 * A `Record` over the creatable types rather than a lookup with a fallback, and the fallback is
 * what asks for it: an entry added without its glyph took the text one in silence, so an
 * approval offered itself under the icon of a prompt.
 */
const INPUT_ICONS: Record<CreatableNodeType, string> = {
  text: mdiFormatText,
  asset: mdiImageOutline,
  stickyNote: mdiNoteOutline,
  approval: mdiAccountCheckOutline,
}

/** One glyph for every generator: what differs between them is the family, and the label says it. */
const GENERATOR_ICON = mdiLayersTripleOutline

export type GraphMenuProps = {
  /** Where the pointer was. Viewport coordinates, as a right-click reports them. */
  at: { x: number; y: number }
  onClose: () => void
  onAdd: (entry: PaletteEntry, position: GraphPosition) => void
}

/**
 * What can be added to a graph, at the point it was asked for.
 *
 * Rendered INSIDE `<ReactFlow>` although it draws through a portal: `screenToFlowPosition` is
 * the viewport's own, and the pane handler that opens this menu sits above the provider where
 * it cannot be reached. React keeps context across a portal, so the menu is in the tree that
 * knows the pan and the zoom, and on the document root where no panel's overflow clips it.
 *
 * The node lands under the pointer rather than at a fixed spot: a canvas that always drops in
 * the same corner makes a graph of any size unbuildable without dragging every node twice.
 */
export function GraphMenu({ at, onClose, onAdd }: GraphMenuProps) {
  const { t } = useTranslation()
  const { screenToFlowPosition } = useReactFlow()

  return (
    <ContextMenu at={at} onClose={onClose}>
      {PALETTE.map((entry, index) => (
        <Fragment key={entry.id}>
          {/* Where the inputs end and the generators begin — the two groups the webapp reads. */}
          {index > 0 && PALETTE[index - 1]?.group !== entry.group && (
            <Separator orientation="horizontal" />
          )}
          <MenuRow
            label={t(paletteLabelKey(entry))}
            icon={entry.group === 'input' ? INPUT_ICONS[entry.node] : GENERATOR_ICON}
            onSelect={() => {
              onAdd(entry, screenToFlowPosition(at))
              onClose()
            }}
          />
        </Fragment>
      ))}
    </ContextMenu>
  )
}
