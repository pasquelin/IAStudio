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
import { NODE_KINDS } from './node-kinds'

/**
 * Add and delete, on the panel's own title bar. Shared by the mesh and light panels, which
 * differ only by the registry that fills the flyout and by the node type they may remove.
 */
export function NodeActions({ documentId, type }: { documentId: string; type: SceneNodeType }) {
  const { t } = useTranslation()
  const { entries, namespace } = NODE_KINDS[type]
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const flyout = useHoverFlyout(entries.length)
  const addNodeOf = useAddNode(documentId)

  // A boolean rather than the node: the panel owns half the scene, and must not delete the
  // other half's selection.
  const removable = useScenes(state => {
    const scene = sceneOf(state, documentId)
    return scene.selectedId !== null && nodeById(scene, scene.selectedId)?.type === type
  })

  return (
    <>
      <div {...flyout.wrapProps} className="contents">
        <ToolButton
          ref={setAnchor}
          icon={mdiPlus}
          label={t(`${namespace}.add`)}
          description={t(`${namespace}.addHint`)}
          tooltip={TIP_BOTTOM}
          variant="header"
          // Hovering is not a keyboard gesture: without this the button is unreachable by tab.
          onClick={flyout.open}
        />
        {flyout.showing && (
          <Flyout anchor={anchor} {...flyout.flyoutProps}>
            {entries.map(entry => (
              <MenuRow
                key={entry.kind}
                label={t(entry.labelKey)}
                icon={entry.icon}
                disabled={entry.disabled}
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
        label={t(`${namespace}.remove`)}
        description={t(`${namespace}.removeHint`)}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={!removable}
        onClick={() => {
          const selectedId = sceneOf(useScenes.getState(), documentId).selectedId
          if (selectedId) useScenes.getState().runCommand(documentId, removeNode(selectedId))
        }}
      />
    </>
  )
}
