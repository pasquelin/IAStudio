import {
  mdiCallMerge,
  mdiContentCopy,
  mdiDotsHorizontal,
  mdiFolderPlusOutline,
  mdiFolderRemoveOutline,
  mdiLayersOutline,
  mdiPlus,
  mdiTrashCanOutline,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { ToolButton } from '@/design/ToolButton'
import {
  isGroup,
  layerById,
  pixelLayer,
  type CanvasState,
  type Layer,
} from '@/engines/canvas/canvas-state'
import {
  addLayer,
  duplicateLayer,
  flatten,
  groupLayers,
  mergeDown,
  removeLayer,
  ungroupLayer,
} from '@/engines/canvas/commands'
import { newId } from '@/helpers/ids'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { canvasOf, useCanvases } from '@/stores/canvases'

/**
 * Whether a layer has one under it, among its own siblings. Merging goes down within a level,
 * never through the wall of the group a layer sits in — so the root stack is not the answer.
 */
function hasLayerBelow(state: CanvasState, id: string | null): boolean {
  if (id === null) return false

  const walk = (siblings: readonly Layer[]): boolean => {
    const index = siblings.findIndex(layer => layer.id === id)
    if (index >= 0) return index > 0
    return siblings.some(layer => isGroup(layer) && walk(layer.children))
  }
  return walk(state.layers)
}

/** Add, delete and the stack operations, on the panel's own title bar. */
export function LayerStackActions({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const canvas = useCanvases(state => canvasOf(state, documentId))
  const active = canvas.activeLayerId
  const activeLayer = layerById(canvas, active)
  const perform = (command: Parameters<ReturnType<typeof useCanvases.getState>['runCommand']>[1]) =>
    useCanvases.getState().runCommand(documentId, command)

  const create = (): void => {
    perform(addLayer(pixelLayer(newId(), t('layers.untitled', { n: canvas.layers.length + 1 }))))
  }

  /**
   * Every stack operation, behind one button. They are five, the title bar holds two, and none
   * of them is reached often enough to earn a place on the line.
   */
  const operations = [
    {
      key: 'group',
      icon: mdiFolderPlusOutline,
      enabled: active !== null,
      run: () => active && perform(groupLayers([active], newId(), t('layers.groupName'))),
    },
    {
      key: 'ungroup',
      icon: mdiFolderRemoveOutline,
      enabled: activeLayer !== null && isGroup(activeLayer),
      run: () => active && perform(ungroupLayer(active)),
    },
    {
      key: 'duplicate',
      icon: mdiContentCopy,
      enabled: active !== null,
      run: () =>
        active &&
        perform(
          duplicateLayer(active, newId(), t('layers.copyName', { name: activeLayer?.name }), newId),
        ),
    },
    {
      key: 'mergeDown',
      icon: mdiCallMerge,
      enabled: hasLayerBelow(canvas, active),
      run: () => active && perform(mergeDown(active)),
    },
    {
      key: 'flatten',
      icon: mdiLayersOutline,
      enabled: canvas.layers.length > 1,
      run: () => perform(flatten(newId(), t('layers.flatName'))),
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
        // The last layer never goes: a canvas with an empty stack cannot be painted on.
        disabled={canvas.layers.length <= 1 || active === null}
        onClick={() => active && perform(removeLayer(active))}
      />
      <MenuButton
        icon={mdiDotsHorizontal}
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
