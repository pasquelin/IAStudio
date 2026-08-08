import {
  mdiContentCopy,
  mdiDotsHorizontal,
  mdiFolderPlusOutline,
  mdiFolderRemoveOutline,
  mdiPlus,
  mdiTrashCanOutline,
  mdiTune,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { ToolButton } from '@/design/ToolButton'
import {
  ADJUSTMENT_KINDS,
  adjustmentLayer,
  allLayers,
  isGroup,
  layerById,
  pixelLayer,
} from '@/engines/canvas/canvas-state'
import {
  addLayer,
  duplicateLayer,
  groupLayers,
  removeLayer,
  ungroupLayer,
} from '@/engines/canvas/commands'
import { newId } from '@/helpers/ids'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { canvasOf, useCanvases } from '@/stores/canvases'

/** What the stack menu offers. Each one names itself from `layers.<operation>`. */
export type LayerOperation = 'group' | 'ungroup' | 'duplicate'

export const LAYER_OPERATIONS: readonly LayerOperation[] = ['group', 'ungroup', 'duplicate']

/** Add, delete and the stack operations, on the panel's own title bar. */
export function LayerStackActions({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const canvas = useCanvases(state => canvasOf(state, documentId))
  const active = canvas.activeLayerId
  const activeLayer = layerById(canvas, active)
  const perform = (command: Parameters<ReturnType<typeof useCanvases.getState>['runCommand']>[1]) =>
    useCanvases.getState().runCommand(documentId, command)

  // The whole tree, not the root: a stack whose layers all sit in one group has one root entry
  // and five things to delete.
  const paintable = allLayers(canvas.layers).filter(layer => !isGroup(layer))

  const create = (): void => {
    perform(addLayer(pixelLayer(newId(), t('layers.untitled', { n: paintable.length + 1 }))))
  }

  /**
   * Every stack operation, behind one button. None of them is reached often enough to earn a
   * place on the line, and merging and flattening left the menu altogether — they emptied the
   * document from a button nobody expected to. Both stayed as commands.
   */
  const operations: readonly {
    key: LayerOperation
    icon: string
    enabled: boolean
    run: () => void
  }[] =
    activeLayer === null
      ? []
      : [
          {
            key: 'group',
            icon: mdiFolderPlusOutline,
            enabled: true,
            run: () => perform(groupLayers([activeLayer.id], newId(), t('layers.groupName'))),
          },
          {
            key: 'ungroup',
            icon: mdiFolderRemoveOutline,
            enabled: isGroup(activeLayer),
            run: () => perform(ungroupLayer(activeLayer.id)),
          },
          {
            key: 'duplicate',
            icon: mdiContentCopy,
            enabled: true,
            run: () =>
              perform(
                duplicateLayer(
                  activeLayer.id,
                  newId(),
                  t('layers.copyName', { name: activeLayer.name }),
                  newId,
                ),
              ),
          },
        ]

  return (
    <>
      <ToolButton
        icon={mdiPlus}
        label={t('layers.add')}
        description={t('layers.addHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        onClick={create}
      />
      <ToolButton
        icon={mdiTrashCanOutline}
        label={t('layers.remove')}
        description={t('layers.removeHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        // The last paintable layer never goes: a canvas with an empty stack cannot be painted on.
        disabled={paintable.length <= 1 || active === null}
        onClick={() => active && perform(removeLayer(active))}
      />
      <MenuButton
        icon={mdiTune}
        label={t('adjustment.add')}
        description={t('adjustment.addHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        rowCount={ADJUSTMENT_KINDS.length}
        opensOnClick
        rows={close =>
          ADJUSTMENT_KINDS.map(kind => (
            <MenuRow
              key={kind}
              label={t(`adjustment.${kind}`)}
              icon={mdiTune}
              onSelect={() => {
                perform(addLayer(adjustmentLayer(newId(), t(`adjustment.${kind}`), kind)))
                close()
              }}
            />
          ))
        }
      />
      <MenuButton
        icon={mdiDotsHorizontal}
        disabled={operations.length === 0}
        label={t('layers.operations')}
        description={t('layers.operationsHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        rowCount={operations.length}
        opensOnClick
        rows={close =>
          operations.map(operation => (
            <MenuRow
              key={operation.key}
              label={t(`layers.${operation.key}`)}
              icon={operation.icon}
              disabled={!operation.enabled}
              onSelect={() => {
                operation.run()
                close()
              }}
            />
          ))
        }
      />
    </>
  )
}
