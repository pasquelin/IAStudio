import { mdiCircleMedium } from '@mdi/js'
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
  /** The glyph standing in for a picture. No thumbnail is fetched here: that is the catalogue's. */
  icon: string
  /** Whether a tab is showing this file right now. Only a document can be. */
  open: boolean
  /** Whether this entry has been CUT and is waiting for a paste. */
  waiting?: boolean
  /** Fired with the new name, or with the old one when the edit was abandoned. */
  onRename?: (name: string) => void
  /** What picking this card up carries — the whole selection where it is part of one. */
  dragIds: readonly string[]
  /**
   * Whether the batch currently in the hand may land IN this card. Answered by the panel and not
   * here: what is being dragged cannot be read off the event before the drop, by design of the
   * platform, so only whoever kept it at `dragStart` can say.
   */
  accepts: boolean
  onDropInto: (ids: readonly string[]) => void
  /**
   * What this card has just picked up, told to the panel so it can answer `accepts` for the other
   * cards. The panel is the only place that can hold it: a card knows what IT carries and nothing
   * about what is passing over its neighbours.
   */
  onPickUp: (ids: readonly string[]) => void
  /** The gesture is over, however it ended — dropped here, dropped elsewhere, or abandoned. */
  onRelease: () => void
}

/**
 * One entry of the project folder, as a tile.
 *
 * The grid's counterpart to `EntryRow`, and it carries the drag itself where the row has `Tree`
 * do it: `Collection` owns selection, activation and the menu for every panel that lists items,
 * and none of them but this one drags. The channel is shared, so a file picked up here would drop
 * into the tree just as well.
 */
export function EntryCard({
  name,
  icon,
  open,
  waiting,
  onRename,
  dragIds,
  accepts,
  onDropInto,
  onPickUp,
  onRelease,
}: EntryCardProps) {
  const { t } = useTranslation()
  const [over, setOver] = useState(false)

  return (
    <div
      // The tile itself is the handle. `draggable` on a container makes everything inside it
      // draggable too, so the guard below is what keeps a name being typed from starting a drag
      // instead of selecting a word — `Tree`'s rows carry the same one, for the same reason.
      draggable={onRename === undefined}
      onDragStart={event => {
        if (event.target !== event.currentTarget) return event.preventDefault()
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
        // The same outline the tree draws on the row a drop would land in, so one gesture reads
        // alike in both renderings.
        over && 'outline-accent rounded-(--radius-sc-md) outline -outline-offset-1',
        // A cut tile is dimmed, which is what every file browser does with one: the file is still
        // there and still opens, and the gesture is not finished. `opacity` rather than a quiet
        // ink because what is being dimmed is a PICTURE — there is no ink to quieten on a tile,
        // and tinting the caption alone would leave the tile itself looking untouched.
        waiting && 'opacity-50',
      )}
    >
      <MediaTile
        caption={name}
        fallbackIcon={icon}
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
