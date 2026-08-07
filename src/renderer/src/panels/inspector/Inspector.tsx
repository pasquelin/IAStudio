import { mdiTuneVariant } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { EmptyState } from '@/design/EmptyState'
import { PropertyGroup, PropertyRow } from '@/design/PropertyRow'
import { clipById, trackById } from '@/engines/timeline/timeline-state'
import { formatBytes } from '@/helpers/format'
import { assetsById, useAssets } from '@/stores/assets'
import { activeSceneId, activeSequenceId, useDocuments } from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useSelection } from '@/stores/selection'
import { AssetInspector } from './AssetInspector'
import { ClipInspector } from './ClipInspector'
import { SceneInspector } from './SceneInspector'
import { TrackInspector } from './TrackInspector'

/**
 * What the selection is, read out.
 *
 * It owns no state: every face reads the store that holds the thing it describes, so two
 * panels showing the same clip cannot disagree about it. One panel for the whole studio — a
 * scene node, an asset, a clip, a track — because "what is selected" is one question, and an
 * inspector per space would be four panels to learn to find.
 */
export function Inspector() {
  // The scroller belongs here rather than to each face: one of them used to forget it.
  return (
    <div className="h-full overflow-y-auto">
      <Face />
    </div>
  )
}

function Face() {
  const selection = useSelection(state => state.selection)
  const sceneId = useDocuments(activeSceneId)
  const sequenceId = useDocuments(activeSequenceId)
  const sequence = useSequences(state => (sequenceId ? sequenceOf(state, sequenceId) : null))
  const byId = useAssets(assetsById)

  switch (selection.kind) {
    case 'asset': {
      // Keyed rather than filtered: a selection of a handful against a catalogue of thousands
      // was scanning the whole of it, per render.
      const chosen = selection.ids.flatMap(id => byId.get(id) ?? [])
      return chosen.length > 0 ? <AssetSelection assets={chosen} /> : <Empty />
    }

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

    // Nothing was clicked in a panel, so the scene speaks for itself: which node is selected
    // is held by the scene state rather than announced to the selection store.
    default:
      return sceneId ? <SceneInspector documentId={sceneId} /> : <Empty />
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
function AssetSelection({ assets }: { assets: Asset[] }) {
  const { t } = useTranslation()

  const [only] = assets
  if (assets.length === 1 && only) return <AssetInspector asset={only} />

  const total = assets.reduce((bytes, asset) => bytes + (asset.bytes ?? 0), 0)
  return (
    <PropertyGroup title={t('inspector.selection')}>
      <PropertyRow label={t('inspector.count')}>{assets.length}</PropertyRow>
      {total > 0 && <PropertyRow label={t('inspector.size')}>{formatBytes(total)}</PropertyRow>}
    </PropertyGroup>
  )
}
