import { useTranslation } from 'react-i18next'
import { Row } from '@/design/Row'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { InlineRename } from '@/panels/shared/InlineRename'

export type EntryRowProps = {
  /** The name on disk, which is what a file browser shows — never the document's own title. */
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
 * The name is the file's, not the document's title: this panel answers "what is in my project
 * folder", and a row that said `Niveau` where the disk says `a3f1.scene` would be a third name
 * for the same thing — the folder is meant to be read by eye and repaired by hand.
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
  if (onRename)
    return <InlineRename value={name} label={t('explorer.rename')} onCommit={onRename} />

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
