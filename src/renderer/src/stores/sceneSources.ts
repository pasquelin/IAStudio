import { sceneFromGltf } from '@/engines/scene/gltfDocument'
import type { SceneState } from '@/engines/scene/sceneState'
import type { CameraPlacement } from '@/engines/scene/sceneView'
import { createDocumentSource } from './documentSource'
import { sceneOf, sceneStore, useScenes } from './scenes'
import { sceneViewOf, useSceneViews } from './sceneViews'

/**
 * The scenes a montage draws whose document is not open in a tab.
 *
 * A live clip reads its scene on every frame, and the open document is the truth whenever there
 * is one: that is what makes an edit show up in the montage at once. This holds the other case —
 * a sequence that names a scene nobody has opened — read off disk once and kept.
 *
 * It is deliberately NOT written back to: nothing here edits a scene.
 */
const scenes = createDocumentSource({
  kind: 'scene',
  // The very door an open tab comes through, and the studio's own state rides in `extras`. Read
  // any other way, a clip naming a scene nobody had opened drew an EMPTY one — the glTF's `nodes`
  // parse, and none of them is ours.
  parse: payload => sceneFromGltf(payload),
})

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

  return scenes.copyOf(sceneId)
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

/** Reads a scene a montage names but no tab holds. Once per document — see `createDocumentSource`. */
export const loadSceneSource = scenes.load
