import { mdiPaletteSwatchOutline } from '@mdi/js'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { MaterialStyle } from '@shared/domain/style'
import { Collection } from '@/design/Collection/Collection'
import { EmptyState } from '@/design/EmptyState'
import { applyStyle } from '@/engines/texture/commands'
import { sameValues } from '@/helpers/objects'
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
  const material = useTextures(state => (documentId ? state.states[documentId]?.material : null))

  useEffect(() => {
    void useStyles.getState().load()
  }, [])

  // Applying needs a texture to apply TO. The panel still lists what is saved without one: a
  // list that emptied itself when no document was open would read as styles that were lost.
  const apply = (style: MaterialStyle): void => {
    if (!documentId) return
    useTextures.getState().runCommand(documentId, applyStyle(style.id, style.values))
  }

  // Which style is in force is not stored anywhere — `applyStyle` writes its values over the
  // material and keeps no name. It is read back by comparison, which also answers the case that
  // matters: move one slider afterwards and no style is in force any more, which is the truth.
  const applied = styles.filter(style => sameValues(style.values, material)).map(style => style.id)

  return (
    <Collection
      label={t('panels.styles')}
      items={styles}
      selectedIds={applied}
      onActivate={apply}
      renderRow={(style: MaterialStyle) => <StyleRow style={style} />}
      empty={<EmptyState icon={mdiPaletteSwatchOutline} message={t('styles.none')} />}
    />
  )
}
