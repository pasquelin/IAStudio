import { mdiCircleMedium, mdiFolder } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InlineRename } from '@/design/InlineRename'
import { MediaTile } from '@/design/MediaTile'
import { rowDrag } from '@/design/rowDrag'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'

export type EntryCardProps = {
  /** What the card is called — the document's own name where there is one, the file name else. */
  name: string
  /** The glyph drawn until the preview arrives, and instead of it where there is none. */
  icon: string
  /** A preview of the file, asked of the main process and rendered there. */
  preview?: string
  /**
   * Drawn as a SHAPE filling the tile rather than as a glyph inside it. What the grid was
   * missing: a folder and a file were the same dark square wearing a different little sign, so
   * the one question a grid answers faster than a list — which of these is a folder — had to be
   * read off the names.
   */
  folder?: boolean
  /** Whether a tab is showing this file right now. Only a document can be. */
  open: boolean
  /** Whether this entry has been CUT and is waiting for a paste. */
  waiting?: boolean
  /** Fired with the new name, or with the old one when the edit was abandoned. */
  onRename?: (name: string) => void
  /** What picking this card up carries — the whole selection where it is part of one. */
  dragIds: readonly string[]
  /** Whether it may be picked up at all. What the studio keeps for itself is shown, not moved. */
  pickable: boolean
  /** Whether what is in the hand may land IN this card — only the panel can say, see `onPickUp`. */
  accepts: boolean
  onDropInto: (ids: readonly string[]) => void
  /** What this card just picked up, so the panel can answer `accepts` for its neighbours. */
  onPickUp: (ids: readonly string[]) => void
  /** The gesture is over, however it ended — dropped here, dropped elsewhere, or abandoned. */
  onRelease: () => void
}

/**
 * One entry of the project folder, as a tile — the grid's counterpart to `EntryRow`.
 *
 * It carries the drag itself where the row leaves it to `Tree`: `Collection` owns selection,
 * activation and the menu for every panel that lists items, and none of the others drags.
 */
export function EntryCard({
  name,
  icon,
  preview,
  folder,
  open,
  waiting,
  onRename,
  dragIds,
  pickable,
  accepts,
  onDropInto,
  onPickUp,
  onRelease,
}: EntryCardProps) {
  const { t } = useTranslation()
  const [over, setOver] = useState(false)

  return (
    <div
      // `draggable` on a container makes everything inside it draggable too, so the guard below is
      // what keeps a name being typed from starting a drag instead of selecting a word.
      draggable={pickable && onRename === undefined}
      onDragStart={event => {
        // The rule is the RENAME, not the identity of the target: a name being typed must select
        // a word rather than start a drag. It was written as `target !== currentTarget`, which
        // holds only while the tile is empty — a picture is natively draggable, so the gesture
        // starts on the `<img>` and every drag of a previewed file would be refused.
        if (onRename) return event.preventDefault()
        rowDrag.start(event, dragIds)
        onPickUp(dragIds)
      }}
      onDragOver={event => {
        if (!accepts || !rowDrag.carries(event)) return
        // Without this the browser refuses the drop, and neither callback ever fires.
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDragEnd={() => {
        setOver(false)
        onRelease()
      }}
      onDrop={event => {
        setOver(false)
        onRelease()
        if (!accepts) return
        event.preventDefault()
        const carried = rowDrag.idsFrom(event)
        if (carried.length > 0) onDropInto(carried)
      }}
      className={cn(
        'size-full',
        // The outline the tree draws on the row a drop lands in, so one gesture reads alike in both.
        over && 'outline-accent rounded-(--radius-sc-md) outline -outline-offset-1',
        // Cut, and on its way out. An opacity rather than a quiet ink: what dims is a PICTURE, and
        // there is no ink to quieten on one — exempted by name in `tokens.test.ts`.
        waiting && 'opacity-50',
      )}
    >
      <MediaTile
        caption={name}
        fallbackIcon={icon}
        {...(preview ? { url: preview } : {})}
        {...(folder
          ? {
              // The frame belongs to FILES: it bounds a picture that may be pale or transparent,
              // and a box around a folder silhouette reads as one more file.
              bare: true,
              // Quiet ink rather than the accent: thirty of these fill a folder, and a shape read
              // at a glance is a shape that does not shout. The alpha is the one `MediaTile`
              // already draws its own fallback at — below it `tokens.test.ts` refuses the ratio
              // a glyph that INFORMS owes (WCAG 1.4.11).
              face: <UiIcon path={mdiFolder} size="fill" className="text-muted/80" />,
            }
          : {})}
        {...(onRename
          ? {
              captionField: (
                <InlineRename value={name} label={t('documents.renameLabel')} onCommit={onRename} />
              ),
            }
          : {})}
        {...(open
          ? {
              // The corner rather than the glyph the row tints: `MediaTile` draws its own
              // fallback, and a tile that HAS a picture has no glyph left to colour.
              badge: (
                <UiIcon
                  path={mdiCircleMedium}
                  size={16}
                  className="text-accent-ink absolute top-0 left-0"
                />
              ),
            }
          : {})}
      />
    </div>
  )
}
