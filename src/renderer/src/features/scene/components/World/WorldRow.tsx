import { mdiLockOpenVariantOutline, mdiLockOutline } from '@mdi/js'
import { memo } from 'react'
import { MenuButton } from '@/components/MenuButton'
import { MenuRow } from '@/components/MenuRow'
import { Row } from '@/components/Row'
import { InlineRename } from '@/components/InlineRename'
import { ROW_WRAPPER } from '@/components/styles'
import { HINT_RIGHT, TIP_RIGHT } from '@/helpers/tooltip'
import {
  renameTerrain,
  renameTerrainEdit,
  setTerrainEditLocked,
  setTerrainLocked,
} from '@/engines/scene/reliefCommands'
import { useScenes } from '@/stores/scenes'
import type { WorldNode } from './worldNodes'

export type WorldRowLabels = {
  rename: string
  locks: string
  locksHint: string
  lockSculpt: string
  lockSculptHint: string
  lockPlacement: string
  lockPlacementHint: string
  lockEdit: string
  lockEditHint: string
}

export type WorldRowProps = {
  documentId: string
  node: WorldNode
  labels: WorldRowLabels
  renaming: boolean
  onRename: () => void
  onRenamed: () => void
}

export const WorldRow = memo(function WorldRow({
  documentId,
  node,
  labels,
  renaming,
  onRename,
  onRenamed,
}: WorldRowProps) {
  const run = useScenes.getState().runCommand
  const name = node.edit?.name ?? node.terrain.name
  const muted = node.edit ? !node.edit.enabled : !node.terrain.enabled
  const locked = node.edit
    ? node.edit.locked
    : node.terrain.locked.sculpt || node.terrain.locked.placement

  return (
    <div className={ROW_WRAPPER} onDoubleClick={onRename}>
      {renaming ? (
        <InlineRename
          value={name}
          label={labels.rename}
          onCommit={next => {
            onRenamed()
            if (next === name) return
            if (node.edit) run(documentId, renameTerrainEdit(node.terrain.id, node.edit.id, next))
            else run(documentId, renameTerrain(node.terrain.id, next))
          }}
        />
      ) : (
        <Row
          title={name}
          muted={muted}
          actions={
            <MenuButton
              icon={locked ? mdiLockOutline : mdiLockOpenVariantOutline}
              label={labels.locks}
              description={labels.locksHint}
              tooltip={TIP_RIGHT}
              variant="row"
              active={locked}
              rowCount={node.edit ? 1 : 2}
              opensOnClick
              rows={() => {
                const edit = node.edit
                if (edit) {
                  return (
                    <MenuRow
                      label={labels.lockEdit}
                      icon={edit.locked ? mdiLockOutline : mdiLockOpenVariantOutline}
                      checked={edit.locked}
                      tick="on-off"
                      tip={HINT_RIGHT(labels.lockEditHint)}
                      onSelect={() =>
                        run(
                          documentId,
                          setTerrainEditLocked(node.terrain.id, edit.id, !edit.locked),
                        )
                      }
                    />
                  )
                }
                return (
                  <>
                    <MenuRow
                      label={labels.lockSculpt}
                      icon={node.terrain.locked.sculpt ? mdiLockOutline : mdiLockOpenVariantOutline}
                      checked={node.terrain.locked.sculpt}
                      tick="on-off"
                      tip={HINT_RIGHT(labels.lockSculptHint)}
                      onSelect={() =>
                        run(
                          documentId,
                          setTerrainLocked(node.terrain.id, {
                            ...node.terrain.locked,
                            sculpt: !node.terrain.locked.sculpt,
                          }),
                        )
                      }
                    />
                    <MenuRow
                      label={labels.lockPlacement}
                      icon={
                        node.terrain.locked.placement ? mdiLockOutline : mdiLockOpenVariantOutline
                      }
                      checked={node.terrain.locked.placement}
                      tick="on-off"
                      tip={HINT_RIGHT(labels.lockPlacementHint)}
                      onSelect={() =>
                        run(
                          documentId,
                          setTerrainLocked(node.terrain.id, {
                            ...node.terrain.locked,
                            placement: !node.terrain.locked.placement,
                          }),
                        )
                      }
                    />
                  </>
                )
              }}
            />
          }
        />
      )}
    </div>
  )
})
