import { useTranslation } from 'react-i18next'
import { Row } from '@/design/Row'
import { cn } from '@/helpers/cn'

export type EntryRowProps = {
  /** The name on disk, which is what a file browser shows — never the document's own title. */
  name: string
  icon: string
  /** Whether a tab is showing this file right now. Only a document can be. */
  open: boolean
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
export function EntryRow({ name, icon, open }: EntryRowProps) {
  const { t } = useTranslation()

  return (
    <Row
      icon={icon}
      title={name}
      subtitle={open ? t('explorer.open') : undefined}
      // The mark of "open", its own rather than the selection tint: a row can be selected in
      // this tree without being open, and the two must not look alike.
      leading={
        <span
          aria-hidden="true"
          className={cn('size-1 shrink-0 rounded-full', open ? 'bg-accent' : 'bg-transparent')}
        />
      }
    />
  )
}
