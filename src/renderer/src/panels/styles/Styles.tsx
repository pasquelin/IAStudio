import { mdiPaletteSwatchOutline } from '@mdi/js'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { MaterialStyle } from '@shared/domain/style'
import { Collection } from '@/design/Collection'
import { EmptyState } from '@/design/EmptyState'
import { applyStyle } from '@/engines/texture/commands'
import { activeTextureId, useDocuments } from '@/stores/documents'
import { useStyles } from '@/stores/styles'
import { useTextures } from '@/stores/textures'
import { StyleRow } from './StyleRow'

/**
 * The saved ways of reading a material, applied to the texture in front.
 *
 * The rows can only be activated, never picked: there is no plural action here — applying two
 * styles at once means nothing — so `Collection` announces a `list` of `listitem`s rather than a
 * `listbox`, and Enter applies where it opens elsewhere.
 */
export function Styles() {
  const { t } = useTranslation()
  const styles = useStyles(state => state.styles)
  const documentId = useDocuments(activeTextureId)

  useEffect(() => {
    void useStyles.getState().load()
  }, [])

  // Applying needs a texture to apply TO. The panel still lists what is saved without one: a
  // list that emptied itself when no document was open would read as styles that were lost.
  const apply = (style: MaterialStyle): void => {
    if (!documentId) return
    useTextures.getState().runCommand(documentId, applyStyle(style.id, style.values))
  }

  return (
    <Collection
      label={t('panels.styles')}
      items={styles}
      onActivate={apply}
      renderRow={(style: MaterialStyle) => <StyleRow style={style} />}
      empty={<EmptyState icon={mdiPaletteSwatchOutline} message={t('styles.none')} />}
    />
  )
}
