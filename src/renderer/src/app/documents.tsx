import { mdiFileOutline } from '@mdi/js'
import type { IDockviewPanelProps } from 'dockview-react'
import { lazy, Suspense, type FC, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { useDocuments } from '@/stores/documents'

export type DocumentPanelParams = { documentId: string }

/**
 * Loaded when a document of that kind is first opened, not on startup.
 *
 * Between them these four reach three.js, PixiJS, wavesurfer and mediabunny, and importing
 * them here put all four in the chunk the splash screen waits for — five megabytes to open a
 * window that shows an empty centre. A studio session opens one or two of these spaces, and
 * the one it opens costs a few hundred milliseconds it was going to spend anyway.
 */
const ImageDocument = lazy(async () => ({
  default: (await import('@/spaces/image/ImageDocument')).ImageDocument,
}))
const SceneDocument = lazy(async () => ({
  default: (await import('@/spaces/three/SceneDocument')).SceneDocument,
}))
const SequenceDocument = lazy(async () => ({
  default: (await import('@/spaces/video/SequenceDocument')).SequenceDocument,
}))
const AudioDocument = lazy(async () => ({
  default: (await import('@/spaces/audio/AudioDocument')).AudioDocument,
}))

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
  audio: props => (
    <WithDocument id={props.params.documentId}>
      {() => <AudioDocument documentId={props.params.documentId} />}
    </WithDocument>
  ),
}

function Home() {
  const { t } = useTranslation()
  return <EmptyState icon={mdiFileOutline} message={t('documents.none')} />
}

function Loading() {
  const { t } = useTranslation()
  return <EmptyState icon={mdiFileOutline} message={t('collection.loading')} />
}

/**
 * The layout is persisted, the documents are not: a tab restored on startup outlives its
 * document. It must render something closable, not throw with no error boundary above it.
 */
function WithDocument({ id, children }: { id: string; children: () => ReactNode }) {
  const { t } = useTranslation()
  const document = useDocuments(state => state.documents[id])

  if (!document) return <EmptyState icon={mdiFileOutline} message={t('documents.missing')} />
  return <Suspense fallback={<Loading />}>{children()}</Suspense>
}
