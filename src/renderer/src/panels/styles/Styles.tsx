import { mdiDeleteOutline, mdiPaletteSwatchOutline, mdiRenameOutline } from '@mdi/js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MaterialStyle } from '@shared/domain/style'
import { Collection } from '@/design/Collection'
import { ContextMenu } from '@/design/ContextMenu'
import { EmptyState } from '@/design/EmptyState'
import { MenuRow } from '@/design/MenuRow'
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
  const [renaming, setRenaming] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ style: MaterialStyle; at: { x: number; y: number } } | null>(
    null,
  )

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
    <>
      <Collection
        label={t('panels.styles')}
        items={styles}
        onActivate={apply}
        renderRow={(style: MaterialStyle) => (
          <div
            className="h-full min-w-0"
            onContextMenu={event => {
              event.preventDefault()
              setMenu({ style, at: { x: event.clientX, y: event.clientY } })
            }}
          >
            <StyleRow
              style={style}
              renaming={renaming === style.id}
              onRenamed={name => {
                setRenaming(null)
                if (name !== style.name) void useStyles.getState().rename(style.id, name)
              }}
            />
          </div>
        )}
        empty={<EmptyState icon={mdiPaletteSwatchOutline} message={t('styles.none')} />}
      />

      {menu && (
        <ContextMenu at={menu.at} onClose={() => setMenu(null)}>
          <MenuRow
            label={t('styles.rename')}
            icon={mdiRenameOutline}
            onSelect={() => {
              setRenaming(menu.style.id)
              setMenu(null)
            }}
          />
          <MenuRow
            label={t('styles.remove')}
            icon={mdiDeleteOutline}
            onSelect={() => {
              void useStyles.getState().remove(menu.style.id)
              setMenu(null)
            }}
          />
        </ContextMenu>
      )}
    </>
  )
}
