import { useTranslation } from 'react-i18next'
import { Row } from '@/design/Row'
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
    <Row
      icon={icon}
      title={name}
      // The mark of "open", its own rather than the selection tint: a row can be selected in
      // this tree without being open, and the two must not look alike.
      //
      // It used to be a dot AND the word under the name, and the word is what cost: one row in a
      // folder of thirty carries it, and `Tree` is handed a NUMBER for its estimate, so every row
      // in the panel stood at the height of the tallest — 36px against a control's 28, five or six
      // fewer folders on screen for a word that repeats what the dot already says.
      leading={
        <span
          aria-hidden="true"
          className={cn('size-1 shrink-0 rounded-full', open ? 'bg-accent' : 'bg-transparent')}
        />
      }
    />
  )
}
