import {
  mdiContentCopy,
  mdiDotsHorizontal,
  mdiFolderPlusOutline,
  mdiFolderRemoveOutline,
  mdiPlus,
  mdiSelectionDrag,
  mdiTrashCanOutline,
  mdiTune,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { MenuButton } from '@/components/MenuButton'
import { MenuRow } from '@/components/MenuRow'
import { ToolButton } from '@/components/ToolButton'
import {
  ADJUSTMENT_KINDS,
  adjustmentLayer,
  allLayers,
  canRemoveLayer,
  isGroup,
  layerById,
  pixelLayer,
} from '@/engines/canvas/canvasState'
import {
  addLayer,
  duplicateLayer,
  groupLayers,
  removeLayer,
  ungroupLayer,
} from '@/engines/canvas/commands'
import { newId } from '@/helpers/ids'
import { HINT_RIGHT, TIP_BOTTOM } from '@/helpers/tooltip'
import { publishCommand } from '@/services/commandBus'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { selectionOf, useCanvasViews } from '@/stores/canvasViews'

/** What the stack menu offers. Each one names itself from `layers.<operation>`. */
export type LayerOperation = 'group' | 'ungroup' | 'duplicate'

export const LAYER_OPERATIONS: readonly LayerOperation[] = ['group', 'ungroup', 'duplicate']

/** Add, delete and the stack operations, on the panel's own title bar. */
export function LayerStackActions({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const canvas = useCanvases(state => canvasOf(state, documentId))
  const active = canvas.activeLayerId
  const activeLayer = layerById(canvas, active)
  // The BOOLEAN, not the selection: the engine republishes a fresh selection object once per
  // frame while a marquee is being drawn, and this title bar would re-render with it.
  const hasSelection = useCanvasViews(state => selectionOf(state, documentId) !== null)
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
        // A canvas with an empty stack cannot be painted on. Asked of the armed layer rather than
        // counted over the document: a GROUP takes its subtree with it, so a folder holding every
        // pixel layer empties the stack however many the document has.
        disabled={activeLayer === null || !canRemoveLayer(canvas.layers, activeLayer)}
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
              tip={HINT_RIGHT(t(`adjustment.${kind}Hint`))}
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
        rowCount={operations.length + 1}
        opensOnClick
        rows={close => (
          <>
            {operations.map(operation => (
              <MenuRow
                key={operation.key}
                label={t(`layers.${operation.key}`)}
                icon={operation.icon}
                disabled={!operation.enabled}
                tip={HINT_RIGHT(t(`layers.${operation.key}Hint`))}
                onSelect={() => {
                  operation.run()
                  close()
                }}
              />
            ))}

            {/* Published rather than run: carving the mask is the ENGINE's, and this panel holds
                none. Addressed to the document it shows, unlike the native menu row: a panel
                pinned to a background image must not engrave the one in front. */}
            <MenuRow
              label={t('commands.canvasMaskFromSelection.title')}
              icon={mdiSelectionDrag}
              disabled={!hasSelection}
              tip={HINT_RIGHT(t('commands.canvasMaskFromSelection.help'))}
              onSelect={() => {
                publishCommand('canvas.maskFromSelection', documentId)
                close()
              }}
            />
          </>
        )}
      />
    </>
  )
}
