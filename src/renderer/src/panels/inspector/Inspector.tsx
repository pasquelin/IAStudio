import { mdiTuneVariant } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { PropertyGroup } from '@/design/PropertyGroup'
import { PropertyRow } from '@/design/PropertyRow'
import { PANEL_SCROLL } from '@/design/styles'
import { clipById, trackById } from '@/engines/timeline/timeline-state'
import { formatBytes } from '@/helpers/format'
import { assetsById, useAssets } from '@/stores/assets'
import { layerById, type Layer } from '@/engines/canvas/canvas-state'
import { canvasOf, useCanvases } from '@/stores/canvases'
import {
  activeImageId,
  activeSceneId,
  activeSequenceId,
  activeTextureId,
  useDocuments,
} from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useSelection } from '@/stores/selection'
import { AssetInspector } from './AssetInspector'
import { ClipInspector } from './ClipInspector'
import { LayerInspector } from './LayerInspector'
import { SceneInspector } from './SceneInspector'
import { TextureInspector } from './TextureInspector'
import { TrackInspector } from './TrackInspector'
import { inspectedTextureId } from './inspected'

/**
 * What the selection is, read out.
 *
 * It owns no state: every face reads the store that holds the thing it describes, so two
 * panels showing the same clip cannot disagree about it. One panel for the whole studio — a
 * scene node, an asset, a clip, a track, a layer — because "what is selected" is one question,
 * and an inspector per space would be six panels to learn to find.
 */
export function Inspector() {
  // The scroller belongs here rather than to each face: one of them used to forget it.
  return (
    <div className={PANEL_SCROLL}>
      <Face />
    </div>
  )
}

function Face() {
  const selection = useSelection(state => state.selection)
  const sceneId = useDocuments(activeSceneId)
  const sequenceId = useDocuments(activeSequenceId)
  const sequence = useSequences(state => (sequenceId ? sequenceOf(state, sequenceId) : null))
  const textureId = useDocuments(activeTextureId)
  const imageId = useDocuments(activeImageId)
  const canvas = useCanvases(state => (imageId ? canvasOf(state, imageId) : null))

  const layerOf = (documentId: string, picked: { ids: readonly string[] }): Layer | null =>
    canvas && documentId === imageId ? layerById(canvas, picked.ids[0] ?? null) : null

  switch (selection.kind) {
    // The catalogue is read by the face that needs it, not here: subscribing to it from `Face`
    // re-rendered the clip and track inspectors on every catalogue refresh too.
    case 'asset':
      return <AssetSelection ids={selection.ids} />

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
        <Empty />
      )
    }

    case 'layer': {
      // Guarded on the owner, as the clip and track faces are: the image in front is not
      // necessarily the one this layer was picked in.
      const layer = selection.ownerId === imageId && imageId ? layerOf(imageId, selection) : null
      return imageId && layer ? <LayerInspector documentId={imageId} layer={layer} /> : <Empty />
    }

    case 'track': {
      const track =
        sequence && selection.ownerId === sequenceId
          ? trackById(sequence, selection.ids[0] ?? '')
          : null
      return sequenceId && track ? (
        <TrackInspector documentId={sequenceId} track={track} />
      ) : (
        <Empty />
      )
    }

    // The only face whose descriptor carries no ids: a scene says which of its nodes are
    // selected from its own state, and `SceneInspector` reads them there — see `Selection`.
    // Guarded on the owner all the same, as the three faces above are: the scene in front is
    // not necessarily the one the node was picked in.
    case 'node':
      return sceneId && selection.ownerId === sceneId ? (
        <SceneInspector documentId={sceneId} />
      ) : (
        <Empty />
      )

    // Nothing was clicked in a panel, so the document in front speaks for itself: a scene shows
    // its environment, and a texture has nothing to select — the material IS the document. At
    // most one id is set, so the order below is reading order.
    default: {
      if (sceneId) return <SceneInspector documentId={sceneId} />
      // Through the same answer the title row reads, so the button it carries and the face
      // below it can never describe two different things.
      const material = inspectedTextureId(selection, sceneId, textureId)
      return material ? <TextureInspector documentId={material} /> : <Empty />
    }
  }
}

function Empty() {
  const { t } = useTranslation()
  return <EmptyState icon={mdiTuneVariant} message={t('inspector.empty')} />
}

/**
 * Several assets at once are summarised rather than detailed: showing the first one's prompt
 * for a selection of twelve is how someone regenerates the wrong thing.
 */
function AssetSelection({ ids }: { ids: readonly string[] }) {
  const { t, i18n } = useTranslation()
  const byId = useAssets(assetsById)

  // Keyed rather than filtered: a selection of a handful against a catalogue of thousands was
  // scanning the whole of it, per render.
  const assets = ids.flatMap(id => byId.get(id) ?? [])

  const [only] = assets
  if (assets.length === 0) return <Empty />
  if (assets.length === 1 && only) return <AssetInspector asset={only} />

  const total = assets.reduce((bytes, asset) => bytes + (asset.bytes ?? 0), 0)
  return (
    <PropertyGroup title={t('inspector.selection')}>
      <PropertyRow label={t('inspector.count')}>{assets.length}</PropertyRow>
      {total > 0 && (
        <PropertyRow label={t('inspector.size')}>
          {formatBytes(total, unit => t(`units.${unit}`), i18n.language)}
        </PropertyRow>
      )}
    </PropertyGroup>
  )
}
