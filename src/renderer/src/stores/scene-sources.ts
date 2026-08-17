import { create } from 'zustand'
import { sceneFromPayload } from '@/engines/scene/sceneDocument'
import type { SceneState } from '@/engines/scene/sceneState'
import type { CameraPlacement } from '@/engines/scene/sceneView'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { sceneOf, sceneStore, useScenes } from './scenes'
import { sceneViewOf, useSceneViews } from './scene-views'

type SceneSourcesState = {
  /** Keyed by document id, and holding only scenes NO tab has open — see `montageSceneOf`. */
  scenes: Record<string, SceneState>
  /** Which reads are in flight, so a montage asking sixty times a second reads the file once. */
  reading: Set<string>
  install: (sceneId: string, scene: SceneState) => void
  begin: (sceneId: string) => boolean
}

/**
 * The scenes a montage draws whose document is not open in a tab.
 *
 * A live clip reads its scene on every frame, and the open document is the truth whenever there
 * is one: that is what makes an edit show up in the montage at once. This holds the other case —
 * a sequence that names a scene nobody has opened — read off disk once and kept.
 *
 * It is deliberately NOT written back to: nothing here edits a scene. Opening that document in
 * its own tab takes over, since `montageSceneOf` prefers the tab.
 */
const useSceneSources = create<SceneSourcesState>()((set, get) => ({
  scenes: {},
  reading: new Set(),

  install: (sceneId, scene) => set(state => ({ scenes: { ...state.scenes, [sceneId]: scene } })),

  begin: sceneId => {
    if (get().reading.has(sceneId)) return false
    get().reading.add(sceneId)
    return true
  },
}))

/**
 * The scene a montage should draw for a document id: the open tab's if there is one, the copy
 * read off disk otherwise, and `null` while neither has arrived.
 *
 * Read on every frame by `createStudioSink`, which is why it is a plain function over both
 * stores rather than a hook: engines subscribe to nothing.
 */
export function montageSceneOf(sceneId: string): SceneState | null {
  const documents = useScenes.getState()
  // The tab wins whenever it holds the document — that is where edits land, and drawing the
  // disk copy instead is exactly the staleness a live clip exists to avoid.
  if (sceneStore.hasState(documents, sceneId)) return sceneOf(documents, sceneId)

  return useSceneSources.getState().scenes[sceneId] ?? null
}

/**
 * Where that scene's own 3D tab has its camera, or `null` when it has none to offer.
 *
 * The framing a montage uses for a scene that holds no camera: it is the one view somebody
 * actually chose. Null while that tab has never been opened or never moved — and in a second
 * window, whose stores are its own, so a video return falls back to framing the contents.
 */
export function montageViewOf(sceneId: string): CameraPlacement | null {
  return sceneViewOf(useSceneViews.getState(), sceneId).camera
}

/**
 * Reads a scene a montage names but no tab holds. Once per document: the sink calls this when
 * the source opens, and a failure leaves the clip drawing nothing rather than retrying forever.
 */
export function loadSceneSource(sceneId: string): void {
  const bridge = getBridge()
  if (!bridge || !useSceneSources.getState().begin(sceneId)) return

  void bridge.documents
    .read(sceneId, 'scene')
    .then(file => {
      if (file) useSceneSources.getState().install(sceneId, sceneFromPayload(file.content))
    })
    .catch(error => reportFailure('document.load', sceneId, error))
}
