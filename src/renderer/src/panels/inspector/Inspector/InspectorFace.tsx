import { clipById, trackById } from '@/engines/timeline/timeline-state'
import { layerById } from '@/engines/canvas/canvas-state'
import { canvasOf, useCanvases } from '@/stores/canvases'
import {
  activeImageId,
  activeSceneId,
  activeMontageId,
  activeTextureId,
  useDocuments,
} from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useSelection } from '@/stores/selection'
import { ClipInspector } from '../ClipInspector'
import { FileInspector } from '../FileInspector'
import { LayerInspector } from '../LayerInspector'
import { SceneInspector } from '../SceneInspector'
import { TextureInspector } from '../TextureInspector/TextureInspector'
import { TrackInspector } from '../TrackInspector'
import { inspectedTextureId } from '../inspected'
import { InspectorAssetSelection } from './InspectorAssetSelection'
import { InspectorEmpty } from './InspectorEmpty'

export function InspectorFace() {
  const selection = useSelection(state => state.selection)
  const sceneId = useDocuments(activeSceneId)
  // The MONTAGE in front, not the sequence: the Audio workspace shows one too, and reading only
  // the sequence left every clip and track picked there with an empty inspector.
  const sequenceId = useDocuments(activeMontageId)
  const sequence = useSequences(state => (sequenceId ? sequenceOf(state, sequenceId) : null))
  const textureId = useDocuments(activeTextureId)
  const imageId = useDocuments(activeImageId)
  const canvas = useCanvases(state => (imageId ? canvasOf(state, imageId) : null))

  switch (selection.kind) {
    // The catalogue is read by the face that needs it, not here: subscribing to it from this one
    // re-rendered the clip and track inspectors on every catalogue refresh too.
    case 'asset':
      return <InspectorAssetSelection ids={selection.ids} />

    // Paths, not ids: what the explorer picks is a file of the project folder, and most of them
    // have no row anywhere — which is the whole difference between this face and the one above.
    case 'file':
      return <FileInspector paths={selection.ids} />

    // Both guarded on the owner: the sequence in front is not necessarily the one this was
    // selected in, and every sequence has a track called `V1`.
    case 'clip': {
      // Which clip comes from the sequence rather than from the descriptor: `selectedId` is
      // what the canvas highlights, and commands move it — dropping an asset selects the clip
      // it creates. Reading the id here instead would leave the two showing different clips.
      const chosen = sequence && selection.ownerId === sequenceId ? sequence.selectedId : null
      const clip = sequence && chosen ? clipById(sequence, chosen) : null
      return sequenceId && sequence && clip ? (
        <ClipInspector documentId={sequenceId} sequence={sequence} clip={clip} />
      ) : (
        <InspectorEmpty />
      )
    }

    case 'layer': {
      // Guarded on the owner, as the clip and track faces are: the image in front is not
      // necessarily the one this layer was picked in. `canvas` is null without an image, which
      // is what makes the owner check enough on its own.
      const layer =
        canvas && selection.ownerId === imageId ? layerById(canvas, selection.ids[0] ?? null) : null
      return imageId && layer ? (
        <LayerInspector documentId={imageId} layer={layer} />
      ) : (
        <InspectorEmpty />
      )
    }

    case 'track': {
      const track =
        sequence && selection.ownerId === sequenceId
          ? trackById(sequence, selection.ids[0] ?? '')
          : null
      return sequenceId && track ? (
        <TrackInspector documentId={sequenceId} track={track} />
      ) : (
        <InspectorEmpty />
      )
    }
  }

  // `none` and `node` both land here, and deliberately: neither names a thing the document in
  // front might not hold. Nothing was clicked at all, or a scene node was — and a scene says
  // which of its nodes from its OWN state, which `SceneInspector` reads there. That is why this
  // one is not guarded on its owner as the three faces above are: guarding it emptied the panel
  // on every switch between two scenes, and kept it empty over a texture afterwards. At most one
  // id is set below, so the order is reading order.
  if (sceneId) return <SceneInspector documentId={sceneId} />

  // Through the same answer the title row reads, so the button it carries and the face below it
  // can never describe two different things.
  const material = inspectedTextureId(selection, sceneId, textureId)
  return material ? <TextureInspector documentId={material} /> : <InspectorEmpty />
}
