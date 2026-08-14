import { mdiDownloadOutline } from '@mdi/js'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { startLibraryDrag } from '@/helpers/asset-drag'
import { showContextMenu } from '@/helpers/context-menu'
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

        /**
         * Both conditions are READ here rather than subscribed to: they are only ever shown
         * inside a menu that is closed almost always, and a subscription would re-render every
         * library tile of the window on each transfer — the busy flag flips twice per fetch.
         *
         * Without a project there is no folder to write the file into, and one transfer at a
         * time is `useCloud`'s own rule.
         */
        const canFetch = useProject.getState().project !== null && !useCloud.getState().busy

        void showContextMenu([
          {
            label: t('assets.fetchAction'),
            icon: mdiDownloadOutline,
            tooltip: t('assets.fetchActionHint'),
            // Greyed rather than hidden, as every other menu here: an entry that comes and goes
            // depending on what is open is one nobody can learn.
            disabled: !canFetch,
            onSelect: () => void useCloud.getState().pull([asset.id]),
          },
        ])
      }}
    >
      {children}
    </div>
  )
}
