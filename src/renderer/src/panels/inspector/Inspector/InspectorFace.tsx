import { designatedIn } from '@/engines/timeline/timelineState'
import { layerById } from '@/engines/canvas/canvasState'
import { canvasOf, useCanvases } from '@/stores/canvases'
import {
  activeImageId,
  activeSceneId,
  activeMontageId,
  activeSkyboxId,
  activeMaterialId,
  useDocuments,
} from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { ClipInspector } from '../ClipInspector'
import { LayerInspector } from '../LayerInspector/LayerInspector'
import { SceneInspector } from '../SceneInspector'
import { SkyboxInspector } from '../SkyboxInspector/SkyboxInspector'
import { MaterialInspector } from '../MaterialInspector/MaterialInspector'
import { TrackInspector } from '../TrackInspector'
import { InspectorEmpty } from './InspectorEmpty'

/**
 * 🛑 The DOCUMENT in front decides, and everything it shows is read from that document — nothing
 * here asks the studio's global descriptor anything. An asset opens under its own row of the
 * shelf (`AssetDetails`), and a file is read in the information window.
 *
 * The order below is a reading order and not a priority: `activeIdOfKind` answers off one
 * `activeId`, so at most one of these ids is ever set.
 */
export function InspectorFace() {
  const sceneId = useDocuments(activeSceneId)
  // The MONTAGE in front, not the sequence: the Audio workspace shows one too, and reading only
  // the sequence left every clip and track picked there with an empty inspector.
  const sequenceId = useDocuments(activeMontageId)
  const sequence = useSequences(state => (sequenceId ? sequenceOf(state, sequenceId) : null))
  const textureId = useDocuments(activeMaterialId)
  const skyboxId = useDocuments(activeSkyboxId)
  const imageId = useDocuments(activeImageId)
  const canvas = useCanvases(state => (imageId ? canvasOf(state, imageId) : null))

  // `activeLayerId`, which is where a layer's own document holds it: one born on the canvas arms
  // it without any pointer being involved.
  if (imageId) {
    const layer = canvas ? layerById(canvas, canvas.activeLayerId) : null
    return layer ? <LayerInspector documentId={imageId} layer={layer} /> : <InspectorEmpty />
  }

  // Read off the montage, so no owner has to be compared: a clip designated in one tab cannot
  // speak for another.
  if (sequenceId && sequence) {
    const designated = designatedIn(sequence)
    if (designated?.kind === 'track') {
      return <TrackInspector documentId={sequenceId} track={designated.track} />
    }

    return designated ? (
      <ClipInspector documentId={sequenceId} sequence={sequence} clip={designated.clip} />
    ) : (
      <InspectorEmpty />
    )
  }

  // Which node is the scene's own state, read by `SceneInspector` there.
  if (sceneId) return <SceneInspector documentId={sceneId} />

  // A sky has no node to pick: everything on it belongs to the document.
  if (skyboxId) return <SkyboxInspector documentId={skyboxId} />

  return textureId ? <MaterialInspector documentId={textureId} /> : <InspectorEmpty />
}
