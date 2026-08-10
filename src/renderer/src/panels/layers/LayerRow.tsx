import { mdiChevronDown, mdiChevronRight, mdiLockOpenVariantOutline, mdiLockOutline } from '@mdi/js'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { Row } from '@/design/Row'
import { ToolButton } from '@/design/ToolButton'
import { isGroup, type CanvasState, type Layer } from '@/engines/canvas/canvas-state'
import { renameLayer, setLayerLocks, setLayerVisible } from '@/engines/canvas/commands'
import type { Command } from '@/engines/core/history'
import { HINT_RIGHT, TIP_RIGHT } from '@/helpers/tooltip'
import { InlineRename } from '@/panels/shared/InlineRename'
import { VisibilityToggle } from '@/panels/shared/VisibilityToggle'
import { LAYER_LOCKS } from './layer-locks'
import { collapseLayerIn, useCanvases } from '@/stores/canvases'

/** Resolved by the list rather than per row — see `LayerList`. */
export type LayerRowLabels = {
  visible: string
  show: string
  hide: string
  locks: string
  locksHint: string
  rename: string
  collapse: string
  expand: string
}

export type LayerRowProps = {
  documentId: string
  layer: Layer
  /** 0 at the root: each step indents the row, so the stack reads as the tree it is. */
  depth: number
  labels: LayerRowLabels
}

/** One step of indentation. A gauge rather than a pixel count — see `index.css`. */
const INDENT = 'var(--sc-gutter)'

/**
 * Memoized, as `SceneNodeRow` is: layer identity survives every command that does not touch it,
 * so hiding one re-renders one row instead of the whole stack.
 */
export const LayerRow = memo(function LayerRow({
  documentId,
  layer,
  depth,
  labels,
}: LayerRowProps) {
  const { t } = useTranslation()
  const [renaming, setRenaming] = useState(false)
  const run = (command: Command<CanvasState>): void =>
    useCanvases.getState().runCommand(documentId, command)

  const locked = layer.locked.pixels || layer.locked.position || layer.locked.alpha

  return (
    <div
      className="flex h-full min-w-0 items-center"
      style={{ paddingLeft: `calc(${INDENT} * ${depth})` }}
    >
      {isGroup(layer) ? (
        <ToolButton
          icon={layer.collapsed ? mdiChevronRight : mdiChevronDown}
          label={layer.collapsed ? labels.expand : labels.collapse}
          tooltip={TIP_RIGHT}
          variant="header"
          // Both, as `VisibilityToggle` does: `Collection` selects on click and `Tree` on
          // pointer down, so a chevron that swallowed one would steal the selection in the other.
          onPointerDown={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation()
            collapseLayerIn(documentId, layer.id, !layer.collapsed)
          }}
        />
      ) : (
        // A group's chevron and a layer's absence of one must not shift the name sideways.
        <span aria-hidden className="w-(--sc-control) shrink-0" />
      )}

      {/* On the name alone: a double click meant for the chevron or the eye is not a rename. */}
      <div className="min-w-0 flex-1" onDoubleClick={() => setRenaming(true)}>
        {renaming ? (
          <InlineRename
            value={layer.name}
            label={labels.rename}
            onCommit={name => {
              setRenaming(false)
              if (name !== layer.name) run(renameLayer(layer.id, name))
            }}
          />
        ) : (
          <Row
            title={layer.name}
            muted={!layer.visible}
            leading={
              <VisibilityToggle
                visible={layer.visible}
                label={labels.visible}
                description={layer.visible ? labels.hide : labels.show}
                onToggle={() => run(setLayerVisible(layer.id, !layer.visible))}
              />
            }
            actions={
              <MenuButton
                icon={locked ? mdiLockOutline : mdiLockOpenVariantOutline}
                label={labels.locks}
                description={labels.locksHint}
                tooltip={TIP_RIGHT}
                variant="header"
                active={locked}
                // One button rather than three on the line: the row is 24 px tall in compact.
                rowCount={LAYER_LOCKS.length}
                opensOnClick
                rows={() =>
                  LAYER_LOCKS.map(padlock => (
                    <MenuRow
                      key={padlock.key}
                      label={t(padlock.labelKey)}
                      icon={padlock.iconFor(layer.locked[padlock.key])}
                      checked={layer.locked[padlock.key]}
                      tick="on-off"
                      tip={HINT_RIGHT(t(`${padlock.labelKey}Hint`))}
                      onSelect={() =>
                        run(
                          setLayerLocks(layer.id, {
                            ...layer.locked,
                            [padlock.key]: !layer.locked[padlock.key],
                          }),
                        )
                      }
                    />
                  ))
                }
              />
            }
          />
        )}
      </div>
    </div>
  )
})
