import { mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { ToolButton } from '@/design/ToolButton'
import { removeNode } from '@/engines/scene/commands'
import { labelKeyOf, NODE_KINDS } from '@/engines/scene/node-kinds'
import { nodeById, type SceneNodeType } from '@/engines/scene/scene-state'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { useAddNode } from '@/hooks/useAddNode'
import { sceneOf, useScenes } from '@/stores/scenes'

/**
 * Add and delete, on the panel's own title bar. Shared by the mesh and light panels, which
 * differ only by the registry that fills the flyout and by the node type they may remove.
 */
export function NodeActions({ documentId, type }: { documentId: string; type: SceneNodeType }) {
  const { t } = useTranslation()
  const kind = NODE_KINDS[type]
  const { entries, namespace } = kind
  const addNodeOf = useAddNode(documentId)

  const selectedId = useScenes(state => sceneOf(state, documentId).selectedId)
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  // The panel owns half the scene, and must not delete the other half's selection.
  const removable = useMemo(
    () => selectedId !== null && nodeById({ nodes, selectedId }, selectedId)?.type === type,
    [nodes, selectedId, type],
  )

  return (
    <>
      <MenuButton
        icon={mdiPlus}
        label={t(`${namespace}.add`)}
        description={t(`${namespace}.addHint`)}
        tooltip={TIP_BOTTOM}
        variant="header"
        rowCount={entries.length}
        opensOnClick
        rows={close =>
          entries.map(entry => (
            <MenuRow
              key={entry.kind}
              label={t(labelKeyOf(kind, entry))}
              icon={entry.icon}
              disabled={entry.disabled}
              onSelect={() => {
                addNodeOf(entry.kind)
                close()
              }}
            />
          ))
        }
      />

      <ToolButton
        icon={mdiTrashCanOutline}
        label={t(`${namespace}.remove`)}
        description={t(`${namespace}.removeHint`)}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={!removable}
        onClick={() =>
          selectedId && useScenes.getState().runCommand(documentId, removeNode(selectedId))
        }
      />
    </>
  )
}
