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
 * 🛑 The DOCUMENT in front decides, and everything it shows is read from that document. The
 * global selection is asked for one thing only — WHICH clip or track inside a montage — never
 * whether the document gets to speak; an asset opens under its own row of the shelf
 * (`AssetDetails`), and a file is read in the information window.
 *
 * The order below is a reading order and not a priority: `activeIdOfKind` answers off one
 * `activeId`, so at most one of these ids is ever set.
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

  // `activeLayerId`, which is where a layer's own document holds it: one born on the canvas arms
  // it without any pointer being involved.
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

  // Which node is the scene's own state, read by `SceneInspector` there.
  if (sceneId) return <SceneInspector documentId={sceneId} />

  // A sky has no node to pick: everything on it belongs to the document.
  if (skyboxId) return <SkyboxInspector documentId={skyboxId} />

  return textureId ? <TextureInspector documentId={textureId} /> : <InspectorEmpty />
}
