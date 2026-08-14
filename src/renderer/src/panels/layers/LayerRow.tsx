import { mdiLockOpenVariantOutline, mdiLockOutline } from '@mdi/js'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { Row } from '@/design/Row'
import type { CanvasState, Layer } from '@/engines/canvas/canvas-state'
import { renameLayer, setLayerLocks, setLayerVisible } from '@/engines/canvas/commands'
import type { Command } from '@/engines/core/history'
import { HINT_RIGHT, TIP_RIGHT } from '@/helpers/tooltip'
import { InlineRename } from '@/panels/shared/InlineRename'
import { VisibilityToggle } from '@/panels/shared/VisibilityToggle'
import { LAYER_LOCKS } from './layer-locks'
import { useCanvases } from '@/stores/canvases'

/** Resolved by the list rather than per row — see `LayerList`. */
export type LayerRowLabels = {
  visible: string
  show: string
  hide: string
  locks: string
  locksHint: string
  rename: string
}

export type LayerRowProps = {
  documentId: string
  layer: Layer
  labels: LayerRowLabels
}

/**
 * Memoized, as `SceneNodeRow` is: layer identity survives every command that does not touch it,
 * so hiding one re-renders one row instead of the whole stack.
 *
 * The chevron and the indent belong to `Tree`, which owns the geometry of every stack in the
 * studio — this draws what is inside the row and nothing around it.
 */
export const LayerRow = memo(function LayerRow({ documentId, layer, labels }: LayerRowProps) {
  const { t } = useTranslation()
  const [renaming, setRenaming] = useState(false)
  const run = (command: Command<CanvasState>): void =>
    useCanvases.getState().runCommand(documentId, command)

  const locked = layer.locked.pixels || layer.locked.position || layer.locked.alpha

  return (
    <div className="flex h-full min-w-0 flex-1 items-center">
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
