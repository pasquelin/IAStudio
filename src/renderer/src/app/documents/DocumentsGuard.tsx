import { mdiFileOutline } from '@mdi/js'
import { Suspense, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { useDocuments } from '@/stores/documents'
import { DocumentsLoading } from './DocumentsLoading'

/**
 * The layout is persisted, the documents are not: a tab restored on startup outlives its
 * document. Says so plainly rather than throwing — the boundary above would call an ordinary
 * restore a failure.
 */
export function DocumentsGuard({ id, children }: { id: string; children: () => ReactNode }) {
  const { t } = useTranslation()
  const document = useDocuments(state => state.documents[id])

  if (!document) return <EmptyState icon={mdiFileOutline} message={t('documents.missing')} />
  return <Suspense fallback={<DocumentsLoading />}>{children()}</Suspense>
}
