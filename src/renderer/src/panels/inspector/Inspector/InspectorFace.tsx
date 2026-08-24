import { clipById, trackById } from '@/engines/timeline/timelineState'
import { layerById } from '@/engines/canvas/canvasState'
import { canvasOf, useCanvases } from '@/stores/canvases'
import {
  activeImageId,
  activeSceneId,
  activeMontageId,
  activeSkyboxId,
  activeTextureId,
  useDocuments,
} from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useSelection } from '@/stores/selection'
import { ClipInspector } from '../ClipInspector'
import { LayerInspector } from '../LayerInspector/LayerInspector'
import { SceneInspector } from '../SceneInspector'
import { SkyboxInspector } from '../SkyboxInspector/SkyboxInspector'
import { TextureInspector } from '../TextureInspector/TextureInspector'
import { TrackInspector } from '../TrackInspector'
import { InspectorEmpty } from './InspectorEmpty'

/**
 * 🛑 The DOCUMENT in front decides, and nothing else may take the panel from it.
 *
 * The order below is a reading order and not a priority: `activeIdOfKind` answers off one
 * `activeId`, so at most one of these ids is ever set. What the selection is still asked is
 * WHICH thing inside that document — a clip, a track — never whether the document gets to speak.
 *
 * An asset picked in the shelf and a file picked in the explorer used to answer here, first and
 * unguarded, where every other face is scoped to its owner. Clicking a thumbnail then took the
 * panel away from the image being edited, and nothing on screen said why the layers had stopped
 * being described. Both now read out under the list they were picked in — `AssetDetails` and
 * `FileDetails` — which is also where the gestures over them already live.
 */
export function InspectorFace() {
  const selection = useSelection(state => state.selection)
  const sceneId = useDocuments(activeSceneId)
  // The MONTAGE in front, not the sequence: the Audio workspace shows one too, and reading only
  // the sequence left every clip and track picked there with an empty inspector.
  const sequenceId = useDocuments(activeMontageId)
  const sequence = useSequences(state => (sequenceId ? sequenceOf(state, sequenceId) : null))
  const textureId = useDocuments(activeTextureId)
  const skyboxId = useDocuments(activeSkyboxId)
  const imageId = useDocuments(activeImageId)
  const canvas = useCanvases(state => (imageId ? canvasOf(state, imageId) : null))

  // An image is the one document whose inspected thing is read from the document itself:
  // `activeLayerId` is the answer the stack highlights, and the one a layer born on the canvas
  // sets without ever posting a selection.
  if (imageId) {
    const layer = canvas ? layerById(canvas, canvas.activeLayerId) : null
    return layer ? <LayerInspector documentId={imageId} layer={layer} /> : <InspectorEmpty />
  }

  // Both guarded on the owner: every sequence names its first tracks `V1` and `A1`, so a track
  // picked in one tab matches by id in the next and would be described in its place.
  if (sequenceId && sequence) {
    // Which clip comes from the sequence rather than from the descriptor: `selectedId` is what
    // the canvas highlights, and commands move it — dropping an asset selects the clip it
    // creates. Reading the id off the selection would leave the two showing different clips.
    if (selection.kind === 'clip' && selection.ownerId === sequenceId) {
      const clip = sequence.selectedId ? clipById(sequence, sequence.selectedId) : null
      if (clip) return <ClipInspector documentId={sequenceId} sequence={sequence} clip={clip} />
    }

    if (selection.kind === 'track' && selection.ownerId === sequenceId) {
      const track = trackById(sequence, selection.ids[0] ?? '')
      if (track) return <TrackInspector documentId={sequenceId} track={track} />
    }

    return <InspectorEmpty />
  }

  // A scene says which of its nodes from its OWN state, which `SceneInspector` reads there — so
  // nothing is asked of the selection here either.
  if (sceneId) return <SceneInspector documentId={sceneId} />

  // A sky has no node to pick: everything on it belongs to the document. It had a panel of its
  // own until 2026-08-19, stacked above an inspector that read "select something".
  if (skyboxId) return <SkyboxInspector documentId={skyboxId} />

  return textureId ? <TextureInspector documentId={textureId} /> : <InspectorEmpty />
}
