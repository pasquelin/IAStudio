import { mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flyout } from '@/design/Flyout'
import { MenuRow } from '@/design/MenuRow'
import { ToolButton } from '@/design/ToolButton'
import { removeNode } from '@/engines/scene/commands'
import { nodeById, type SceneNodeType } from '@/engines/scene/scene-state'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { useAddNode } from '@/hooks/useAddNode'
import { useHoverFlyout } from '@/hooks/useHoverFlyout'
import { sceneOf, useScenes } from '@/stores/scenes'

/**
 * What both scene registries have in common. `create` is only read for its absence — an entry
 * declared but not buildable yet is greyed, never hidden.
 */
export type RegistryEntry = {
  kind: string
  labelKey: string
  icon: string
  create?: () => unknown
}

export type NodeActionsProps = {
  documentId: string
  /** Which half of the scene the panel owns: it must not delete the other's selection. */
  type: SceneNodeType
  entries: readonly RegistryEntry[]
  addKey: string
  addHintKey: string
  removeKey: string
  removeHintKey: string
}

/**
 * Add and delete, on the panel's own title bar. Shared by the mesh and light panels, which
 * differ only by the registry that fills the flyout and by the node type they may remove.
 */
export function NodeActions({
  documentId,
  type,
  entries,
  addKey,
  addHintKey,
  removeKey,
  removeHintKey,
}: NodeActionsProps) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const flyout = useHoverFlyout(entries.length)
  const selectedId = useScenes(state => sceneOf(state, documentId).selectedId)
  const addNodeOf = useAddNode(documentId)

  const selected = selectedId
    ? nodeById(sceneOf(useScenes.getState(), documentId), selectedId)
    : null

  return (
    <>
      <div {...flyout.wrapProps} className="contents">
        <ToolButton
          ref={setAnchor}
          icon={mdiPlus}
          label={t(addKey)}
          description={t(addHintKey)}
          tooltip={TIP_BOTTOM}
          variant="header"
        />
        {flyout.showing && (
          <Flyout anchor={anchor} {...flyout.flyoutProps}>
            {entries.map(entry => (
              <MenuRow
                key={entry.kind}
                label={t(entry.labelKey)}
                icon={entry.icon}
                disabled={entry.create === undefined}
                tip={TIP_BOTTOM(t(entry.labelKey))}
                onSelect={() => {
                  addNodeOf(entry.kind)
                  flyout.close()
                }}
              />
            ))}
          </Flyout>
        )}
      </div>

      <ToolButton
        icon={mdiTrashCanOutline}
        label={t(removeKey)}
        description={t(removeHintKey)}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={selected?.type !== type}
        onClick={() =>
          selectedId && useScenes.getState().runCommand(documentId, removeNode(selectedId))
        }
      />
    </>
  )
}
