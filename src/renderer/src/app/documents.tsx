import { mdiFileOutline } from '@mdi/js'
import type { IDockviewPanelProps } from 'dockview-react'
import { lazy, Suspense, type FC, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { ErrorBoundary } from '@/design/ErrorBoundary'
import { useDocuments } from '@/stores/documents'

export type DocumentPanelParams = { documentId: string }

/**
 * Loaded when a document of that kind is first opened, not on startup.
 *
 * Between them these reach three.js, PixiJS, wavesurfer and mediabunny, and importing them
 * here put all of them in the chunk the splash screen waits for — five megabytes to open a
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
const SkyboxDocument = lazy(async () => ({
  default: (await import('@/spaces/skyboxes/SkyboxDocument')).SkyboxDocument,
}))
const TextureDocument = lazy(async () => ({
  default: (await import('@/spaces/textures/TextureDocument')).TextureDocument,
}))

/** Every space is opened the same way: the tab checks its document still exists, then renders. */
function panelFor(Space: FC<{ documentId: string }>): FC<IDockviewPanelProps<DocumentPanelParams>> {
  return props => (
    // Above the `Suspense` below: a rejected `lazy()` import is an error, not a fallback. Retry
    // cannot fix that one — React caches the rejection — but the tab stays closable.
    <ErrorBoundary>
      <WithDocument id={props.params.documentId}>
        {() => <Space documentId={props.params.documentId} />}
      </WithDocument>
    </ErrorBoundary>
  )
}

/**
 * Document components handed to Dockview, keyed by `DocumentKind`. `home` is what an empty
 * center shows.
 */
export const DOCUMENT_COMPONENTS: Record<string, FC<IDockviewPanelProps<DocumentPanelParams>>> = {
  home: () => <Home />,
  image: panelFor(ImageDocument),
  scene: panelFor(SceneDocument),
  sequence: panelFor(SequenceDocument),
  audio: panelFor(AudioDocument),
  skybox: panelFor(SkyboxDocument),
  texture: panelFor(TextureDocument),
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
 * document. Says so plainly rather than throwing — the boundary above would call an ordinary
 * restore a failure.
 */
function WithDocument({ id, children }: { id: string; children: () => ReactNode }) {
  const { t } = useTranslation()
  const document = useDocuments(state => state.documents[id])

  if (!document) return <EmptyState icon={mdiFileOutline} message={t('documents.missing')} />
  return <Suspense fallback={<Loading />}>{children()}</Suspense>
}
