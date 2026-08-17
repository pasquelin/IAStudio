import { useTranslation } from 'react-i18next'
import { Row } from '@/design/Row'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { useLoadable } from '@/hooks/useLoadable'
import { InlineRename } from '@/design/InlineRename'

export type EntryRowProps = {
  /**
   * What the row is called. A document's own name — which IS its file name, minus the extension
   * the glyph already says — and the file name for everything else.
   */
  name: string
  icon: string
  /** A preview of the file, drawn at glyph size — the tree shows one too, as a file browser does. */
  preview?: string
  /** Whether a tab is showing this file right now. Only a document can be. */
  open: boolean
  /**
   * Whether this row has been CUT and is waiting for a paste. Dimmed, as every file browser
   * draws it: the file is still there and still opens, and the gesture is not finished.
   */
  waiting?: boolean
  /** Fired with the new name, or with the old one when the edit was abandoned. */
  onRename?: (name: string) => void
}

/**
 * One entry of the project folder.
 *
 * The name shown for a document is the document's, and this row used to argue the opposite: a
 * panel answering "what is in my project folder" showed `6d517ff3-1ff7-4c04….aud` where the tab
 * above it said `ElevenLabs Sound Effects 2`, and nothing on screen said they were one thing.
 * The argument held only while the two could differ. They no longer can — the file is named
 * after the document — and what is left is one name in both places.
 *
 * A document written before that carries the uuid as its file name still, and shows its title
 * here: a name nobody chose is not one to read a folder by, and renaming it settles both.
 *
 * The glyph is the workspace's for a document and a plain sheet for everything else, read off
 * the same table the rail and the asset menu read.
 */
export function EntryRow({ name, icon, preview, open, waiting, onRename }: EntryRowProps) {
  const { t } = useTranslation()
  const { src, onError } = useLoadable(preview)

  // The whole row becomes the field: a name edited beside its own icon is where the eye already
  // is, and `InlineRename` owns the part that is subtle — when the edit ends. It stands a
  // control tall inside a row sized for two lines, so the tint shows above and below it while
  // renaming: deliberate, and not a defect to rediscover.
  //
  // Nothing wraps it to stop the presses around it: `Tree` leaves a row being typed in alone,
  // on the double-click as on the right-click.
  if (onRename)
    // Named for what it HOLDS, as every other rename field of the studio is: `Renommer` is the
    // menu row that opened it, and a field announcing an action names itself after the wrong
    // thing to a reader.
    return <InlineRename value={name} label={t('documents.renameLabel')} onCommit={onRename} />

  return (
    // The mark of "open" is the GLYPH, in accent ink: a row can be selected in this tree without
    // being open, so it cannot be the selection tint — and it has to cost nothing, because it is
    // true of one row in a folder of thirty.
    //
    // It has been a word under the name, then a dot before the icon, and both were paid for by
    // every OTHER row: the word made the panel measure a stacked height throughout, the dot took
    // a column and a gutter — 10px in front of thirty names to be seen in front of one. Colouring
    // what is already there takes none.
    //
    // Through `media` rather than `icon`, which is `Row`'s way of saying "I am drawing this one
    // myself". `accent-ink` and not `accent`: the fill misses 1.4.11 on a panel, the ink clears
    // it — see `index.css`, and `design/tokens.test.ts` refuses the fill outright.
    // A row that has been cut wears quiet ink until it is pasted — `quiet`, never an opacity,
    // which dims whatever the element inherits and leaves no guard able to say what the name
    // ends up reading at. `muted` is the nearest state `Row` already had, and it strikes the
    // name through: that says "not showing", where this says "on its way out".
    <Row
      media={
        src ? (
          // Not draggable: `Tree` carries the row's own drag, and a picture that starts one of
          // its own would take the gesture off the row it belongs to.
          <img
            src={src}
            alt=""
            loading="lazy"
            draggable={false}
            onError={onError}
            className="size-3.5 shrink-0 rounded-(--radius-sc-sm) object-cover"
          />
        ) : (
          <UiIcon path={icon} size={14} className={cn('shrink-0', open && 'text-accent-ink')} />
        )
      }
      title={name}
      quiet={waiting}
    />
  )
}
