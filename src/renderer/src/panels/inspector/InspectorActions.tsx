import { mdiPaletteSwatchOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { activeSceneId, activeTextureId, useDocuments } from '@/stores/documents'
import { useSelection } from '@/stores/selection'
import { useStyles } from '@/stores/styles'
import { textureOf, useTextures } from '@/stores/textures'
import { inspectedTextureId } from './inspected'

/**
 * What the inspector's title row carries.
 *
 * One button, and only on the material face. The inspector is a single panel with seven faces —
 * a layer, a clip, a track, an asset, a graph node, a scene, a texture — so one posted here
 * unconditionally
 * would offer to save a material while a video clip filled the panel below it. Which face is
 * drawn is `inspectedTextureId`, the same answer `Face` renders from.
 */
export function InspectorActions() {
  const { t } = useTranslation()
  const selection = useSelection(state => state.selection)
  const sceneId = useDocuments(activeSceneId)
  const textureId = useDocuments(activeTextureId)
  const documentId = inspectedTextureId(selection, sceneId, textureId)

  if (!documentId) return null

  return (
    <ToolButton
      icon={mdiPaletteSwatchOutline}
      label={t('styles.save')}
      description={t('styles.saveHint')}
      // Without it `description` is never rendered and never announced: every other header
      // button of the studio hands one over, and this was the only one that did not.
      tooltip={TIP_BOTTOM}
      variant="header"
      // The settings are read at click time rather than subscribed to. They are never drawn
      // here, and a drag emits one value per frame: a subscription would redraw this button on
      // every one of them — the cost `useDocumentEdit` exists to keep off the inspector.
      onClick={() => {
        const { material } = textureOf(useTextures.getState(), documentId)
        void useStyles.getState().save(material, t('styles.newName'))
      }}
    />
  )
}
