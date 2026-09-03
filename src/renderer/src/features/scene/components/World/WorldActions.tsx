import { mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/components/ToolButton'
import {
  addTerrain,
  addTerrainEdit,
  removeTerrain,
  removeTerrainEdit,
} from '@/engines/scene/reliefCommands'
import { newId } from '@/helpers/ids'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'

/**
 * Add and delete, drawn on the panel's own title bar. Like the panel itself, it follows the
 * active tab; the stack is split off so its hooks never run without one.
 */
export function WorldActions() {
  const { t } = useTranslation()
  const documentId = useDocuments(activeSceneId)
  const armed = useSceneViews(state =>
    documentId ? sceneViewOf(state, documentId).armedRelief : null,
  )

  if (!documentId) return null

  const run = useScenes.getState().runCommand
  const arm = useSceneViews.getState().setArmedRelief

  const createTerrain = (): void => {
    const id = newId()
    run(documentId, addTerrain({ assetId: '' }, id))
    arm(documentId, { terrainId: id, editId: 'sculpt' })
  }

  const createEdit = (): void => {
    if (!armed) return
    const id = newId()
    run(documentId, addTerrainEdit(armed.terrainId, id))
    arm(documentId, { terrainId: armed.terrainId, editId: id })
  }

  const remove = (): void => {
    if (!armed) return
    if (armed.editId) run(documentId, removeTerrainEdit(armed.terrainId, armed.editId))
    else run(documentId, removeTerrain(armed.terrainId))
    const layers = sceneOf(useScenes.getState(), documentId).world.layers
    const still = layers.find(layer => layer.kind === 'relief' && layer.id === armed.terrainId)
    if (armed.editId && still) arm(documentId, { terrainId: armed.terrainId, editId: null })
    else arm(documentId, null)
  }

  return (
    <>
      <ToolButton
        icon={mdiPlus}
        label={t('world.add')}
        description={t('world.addHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        onClick={createTerrain}
      />
      <ToolButton
        icon={mdiPlus}
        label={t('world.addEdit')}
        description={t('world.addEditHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={armed === null}
        onClick={createEdit}
      />
      <ToolButton
        icon={mdiTrashCanOutline}
        label={t('world.remove')}
        description={t('world.removeHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={armed === null}
        onClick={remove}
      />
    </>
  )
}
