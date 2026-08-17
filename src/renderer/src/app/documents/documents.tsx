import type { IDockviewPanelProps } from 'dockview-react'
import { lazy, type FC } from 'react'
import { ErrorBoundary } from '@/design/ErrorBoundary'
import { DocumentsGuard } from './DocumentsGuard'
import { DocumentsHome } from './DocumentsHome'

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
      <DocumentsGuard id={props.params.documentId}>
        {() => <Space documentId={props.params.documentId} />}
      </DocumentsGuard>
    </ErrorBoundary>
  )
}

/**
 * Document components handed to Dockview, keyed by `DocumentKind`. `home` is what an empty
 * center shows.
 */
export const DOCUMENT_COMPONENTS: Record<string, FC<IDockviewPanelProps<DocumentPanelParams>>> = {
  home: () => <DocumentsHome />,
  image: panelFor(ImageDocument),
  scene: panelFor(SceneDocument),
  sequence: panelFor(SequenceDocument),
  audio: panelFor(AudioDocument),
  skybox: panelFor(SkyboxDocument),
  texture: panelFor(TextureDocument),
}
