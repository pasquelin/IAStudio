import { mdiEye, mdiEyeOffOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { Collection } from '@/design/Collection'
import { EmptyState } from '@/design/EmptyState'
import { Row } from '@/design/Row'
import { ToolButton } from '@/design/ToolButton'
import { selectNode, setNodeVisible } from '@/engines/scene/commands'
import type { SceneNode, SceneNodeType } from '@/engines/scene/scene-state'
import { LIST_ONLY } from '@/helpers/collection-state'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'

export type NodeListProps = {
  documentId: string
  /** Which half of the scene this panel is about. */
  type: SceneNodeType
  emptyIcon: string
  emptyKey: string
  visibleKey: string
  iconFor: (node: SceneNode) => string
}

/** A row carries an eye and a name — no thumbnail, so one line is enough. */
const ROW_HEIGHT = 24

/**
 * The mesh and light panels, which differ only by the slice of the scene they show. Selection,
 * keyboard reach and virtualization come from `Collection`; the line comes from `Row`. Neither
 * is rewritten here, which is the whole point of both existing.
 */
export function NodeList({
  documentId,
  type,
  emptyIcon,
  emptyKey,
  visibleKey,
  iconFor,
}: NodeListProps) {
  const { t } = useTranslation()
  const scene = useScenes(state => sceneOf(state, documentId))
  const store = useScenes.getState()
  const nodes = scene.nodes.filter(node => node.type === type)

  // Read at call time, not from the render that drew the row: selection writes the whole scene
  // back, and a stale copy would undo whatever command ran in between.
  const select = (id: string): void =>
    store.replace(documentId, selectNode(sceneOf(useScenes.getState(), documentId), id))

  return (
    <Collection
      items={nodes}
      state={LIST_ONLY}
      selectedId={scene.selectedId}
      onSelect={node => select(node.id)}
      rowHeight={ROW_HEIGHT}
      renderRow={node => (
        <Row
          icon={iconFor(node)}
          title={node.name}
          muted={!node.visible}
          leading={
            <ToolButton
              icon={node.visible ? mdiEye : mdiEyeOffOutline}
              label={t(visibleKey)}
              tooltip={TIP_RIGHT}
              variant="header"
              // `Collection` selects its cell on click, not on pointer down: without stopping
              // this one, reaching for the eye would also select the row underneath it.
              onClick={event => {
                event.stopPropagation()
                store.runCommand(documentId, setNodeVisible(node.id, !node.visible))
              }}
            />
          }
        />
      )}
      empty={<EmptyState icon={emptyIcon} message={t(emptyKey)} />}
    />
  )
}
