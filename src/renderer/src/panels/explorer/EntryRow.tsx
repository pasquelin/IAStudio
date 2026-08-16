import { useTranslation } from 'react-i18next'
import { Row } from '@/design/Row'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { InlineRename } from '@/design/InlineRename'

export type EntryRowProps = {
  /**
   * What the row is called. A document's own name — which IS its file name, minus the extension
   * the glyph already says — and the file name for everything else.
   */
  name: string
  icon: string
  /** Whether a tab is showing this file right now. Only a document can be. */
  open: boolean
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
export function EntryRow({ name, icon, open, onRename }: EntryRowProps) {
  const { t } = useTranslation()

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
    <Row
      media={<UiIcon path={icon} size={14} className={cn('shrink-0', open && 'text-accent-ink')} />}
      title={name}
    />
  )
}
