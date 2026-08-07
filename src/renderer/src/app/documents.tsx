import { mdiFileOutline } from '@mdi/js'
import type { IDockviewPanelProps } from 'dockview-react'
import type { FC, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { ImageDocument } from '@/spaces/image/ImageDocument'
import { SceneDocument } from '@/spaces/three/SceneDocument'
import { SequenceDocument } from '@/spaces/video/SequenceDocument'
import { useDocuments } from '@/stores/documents'

export type DocumentPanelParams = { documentId: string }

/**
 * Document components handed to Dockview, keyed by `DocumentKind`. `home` is what an empty
 * center shows.
 */
export const DOCUMENT_COMPONENTS: Record<string, FC<IDockviewPanelProps<DocumentPanelParams>>> = {
  home: () => <Home />,
  image: props => (
    <WithDocument id={props.params.documentId}>
      {() => <ImageDocument documentId={props.params.documentId} />}
    </WithDocument>
  ),
  scene: props => (
    <WithDocument id={props.params.documentId}>
      {() => <SceneDocument documentId={props.params.documentId} />}
    </WithDocument>
  ),
  sequence: props => (
    <WithDocument id={props.params.documentId}>
      {() => <SequenceDocument documentId={props.params.documentId} />}
    </WithDocument>
  ),
}

function Home() {
  const { t } = useTranslation()
  return <EmptyState icon={mdiFileOutline} message={t('documents.none')} />
}

/**
 * The layout is persisted, the documents are not: a tab restored on startup outlives its
 * document. It must render something closable, not throw with no error boundary above it.
 */
function WithDocument({ id, children }: { id: string; children: () => ReactNode }) {
  const { t } = useTranslation()
  const document = useDocuments(state => state.documents[id])

  if (!document) return <EmptyState icon={mdiFileOutline} message={t('documents.missing')} />
  return <>{children()}</>
}
