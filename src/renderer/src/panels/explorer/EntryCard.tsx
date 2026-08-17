import { mdiCircleMedium, mdiFile, mdiFolder } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InlineRename } from '@/design/InlineRename'
import { MediaTile } from '@/design/MediaTile'
import { rowDrag } from '@/design/rowDrag'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'

/**
 * What the card stands for, which decides the SHAPE it draws: a folder, a plain file, or a file
 * the studio opens as a document and which keeps the glyph of its own space.
 */
export type EntryKind = 'folder' | 'file' | 'document'

/** The tile draws a filled silhouette where the tree draws an outline. */
const SOLID: Record<Exclude<EntryKind, 'document'>, string> = { folder: mdiFolder, file: mdiFile }

export type EntryCardProps = {
  /** What the card is called — the document's own name where there is one, the file name else. */
  name: string
  /** The glyph of a document's space, drawn in place of the file silhouette. */
  icon: string
  /** A preview of the file, asked of the main process and rendered there. */
  preview?: string
  /**
   * Drawn as a SHAPE filling the tile, with no frame around it — a folder, a file and a document
   * alike. What the grid was missing: a folder and a file were the same dark square wearing a
   * different little sign.
   */
  kind: EntryKind
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
  kind,
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
        // Both conditions are read HERE and not left to `draggable`: a picture is natively
        // draggable, so its `dragstart` bubbles up even from a card the attribute refuses — what
        // the studio keeps for itself would otherwise be dragged by its preview.
        if (onRename || !pickable) return event.preventDefault()
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
        url={preview}
        bare
        // A thumbnail is cut to the file silhouette rather than framed: the tile then says what
        // the entry IS as plainly as the folder next to it, without hiding what it holds.
        cutout={kind === 'file'}
        // The alpha `MediaTile` draws its own fallback at — below it, `tokens.test.ts`
        // refuses the ratio a glyph that INFORMS owes (WCAG 1.4.11).
        face={
          <UiIcon
            path={kind === 'document' ? icon : SOLID[kind]}
            size="fill"
            className="text-muted/80"
          />
        }
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
