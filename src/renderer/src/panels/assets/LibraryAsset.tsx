import { mdiDownloadOutline } from '@mdi/js'
import { useCallback, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { startLibraryDrag } from '@/helpers/asset-drag'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { useCloud } from '@/stores/cloud'
import { useProject } from '@/stores/project'

export type LibraryAssetProps = {
  asset: CloudAsset
  className?: string
  children: ReactNode
}

/**
 * The library line's own gestures — `DraggableAsset`'s counterpart for a cell the catalogue
 * does not hold.
 *
 * Neither of that one's two gestures applies here. There is nothing to drag: an asset with no
 * file cannot be handed to a document, and a drag that dropped an identifier nothing resolves
 * would be a broken promise. And there are no destinations to list: `ASSET_INTENTS` sends a row
 * into an open document, which is exactly what this line cannot do until it has been fetched.
 *
 * So the menu has one entry, and it is the one thing the line is for. The selection is left
 * alone for the same reason `AssetBrowser` filters it: the store speaks catalogue ids, and this
 * asset has none.
 */
export function LibraryAsset({ asset, className, children }: LibraryAssetProps) {
  const { t } = useTranslation()
  /**
   * Where the menu was opened, and what could be done at that moment.
   *
   * The two conditions are READ on opening rather than subscribed to: they are only ever shown
   * inside a menu that is closed almost always, and a subscription here would re-render every
   * library tile of the window on each transfer — the busy flag flips twice per fetch.
   */
  const [menuAt, setMenuAt] = useState<{ x: number; y: number; canFetch: boolean } | null>(null)

  // Stable, or the open menu re-subscribes its three global listeners on every catalogue refresh.
  const closeMenu = useCallback(() => setMenuAt(null), [])

  return (
    <div
      className={className}
      // Dragged exactly like a local one, and announced under the same kind: what a target
      // accepts is the mesh, not where its bytes are. The download happens at the DROP, in
      // `droppedAsset` — one place rather than in each surface that takes an asset.
      draggable
      onDragStart={event => startLibraryDrag(event, asset)}
      onContextMenu={event => {
        event.preventDefault()
        // Without a project there is no folder to write the file into, and one transfer at a
        // time is `useCloud`'s own rule — both true or false for as long as the menu stands.
        const canFetch = useProject.getState().project !== null && !useCloud.getState().busy
        setMenuAt({ x: event.clientX, y: event.clientY, canFetch })
      }}
    >
      {children}
      {menuAt && (
        <ContextMenu at={menuAt} onClose={closeMenu}>
          {/* Disabled rather than hidden, as every other menu here: an entry that comes and goes
              depending on what is open is one nobody can learn. */}
          <MenuRow
            label={t('assets.fetchAction')}
            icon={mdiDownloadOutline}
            disabled={!menuAt.canFetch}
            tip={HINT_RIGHT(t('assets.fetchActionHint'))}
            onSelect={() => {
              closeMenu()
              void useCloud.getState().pull([asset.id])
            }}
          />
        </ContextMenu>
      )}
    </div>
  )
}
