import type { DocumentDescriptor } from '@shared/domain/document'
import { useTranslation } from 'react-i18next'
import { Row } from '@/design/Row'
import { cn } from '@/helpers/cn'
import { workspaceById } from '@/helpers/workspaces'

export type DocumentRowProps = {
  document: DocumentDescriptor
  /** Whether a tab is showing it right now. */
  open: boolean
}

/**
 * One document of the project.
 *
 * The glyph is the workspace's, read off the same table the rail and the asset menu read: a
 * `.seq` has to wear the same icon wherever it is listed, or the two lists are two vocabularies.
 */
export function DocumentRow({ document, open }: DocumentRowProps) {
  const { t } = useTranslation()

  return (
    <Row
      icon={workspaceById(document.workspace).icon}
      title={document.title}
      subtitle={open ? t('explorer.open') : undefined}
      // The mark of "open", and its own rather than the selection tint this list used to borrow.
      // `aria-hidden` because the subtitle already says it in words: a dot repeated to a screen
      // reader is a second announcement of the same thing.
      leading={
        <span
          aria-hidden="true"
          className={cn('size-1 shrink-0 rounded-full', open ? 'bg-accent' : 'bg-transparent')}
        />
      }
    />
  )
}
