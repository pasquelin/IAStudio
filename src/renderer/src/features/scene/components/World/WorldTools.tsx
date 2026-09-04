import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { WorldToolsBrushes } from './WorldToolsBrushes'
import { WorldToolsMask } from './WorldToolsMask'

/** Contextual sculpt tools for the armed terrain or edit. */
export function WorldTools({ documentId }: { documentId: string }) {
  const armed = useSceneViews(state => sceneViewOf(state, documentId).armedRelief)
  const layers = useScenes(state => sceneOf(state, documentId).world.layers)
  const terrain = layers.find(layer => layer.kind === 'relief' && layer.id === armed?.terrainId)
  const edit =
    terrain?.kind === 'relief' ? terrain.edits.find(one => one.id === armed?.editId) : undefined
  if (!armed || !terrain) return null
  return (
    <>
      <WorldToolsBrushes documentId={documentId} terrain={terrain} edit={edit} />
      {edit ? <WorldToolsMask documentId={documentId} terrain={terrain} edit={edit} /> : null}
    </>
  )
}
