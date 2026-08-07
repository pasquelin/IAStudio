import { mdiTuneVariant } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { EmptyState } from '@/design/EmptyState'
import { PropertyGroup, PropertyRow } from '@/design/PropertyRow'
import { formatBytes } from '@/helpers/format'
import { clipById, trackById } from '@/engines/timeline/timeline-state'
import { activeIdOfKind, useDocuments } from '@/stores/documents'
import { useAssets } from '@/stores/assets'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useSelection } from '@/stores/selection'
import { AssetInspector } from './AssetInspector'
import { ClipInspector } from './ClipInspector'
import { TrackInspector } from './TrackInspector'

/**
 * What the selection is, read out. It owns no state: every face reads the store that holds the
 * thing it describes, so two panels showing the same clip cannot disagree about it.
 */
export function Inspector() {
  // The scroller belongs here rather than to each face: one of the four used to forget it.
  return (
    <div className="h-full overflow-auto">
      <Face />
    </div>
  )
}

function Face() {
  const selection = useSelection(state => state.selection)
  const documentId = useDocuments(state => activeIdOfKind(state, 'sequence'))
  const sequence = useSequences(state => (documentId ? sequenceOf(state, documentId) : null))
  const assets = useAssets(state => state.items)

  switch (selection.kind) {
    case 'asset': {
      const chosen = assets.filter(asset => selection.ids.includes(asset.id))
      return chosen.length > 0 ? <AssetSelection assets={chosen} /> : <Empty />
    }

    case 'clip': {
      const clip = sequence?.selectedId ? clipById(sequence, sequence.selectedId) : null
      return documentId && sequence && clip ? (
        <ClipInspector documentId={documentId} sequence={sequence} clip={clip} />
      ) : (
        <Empty />
      )
    }

    case 'track': {
      const track = sequence ? trackById(sequence, selection.id) : null
      return documentId && track ? (
        <TrackInspector documentId={documentId} track={track} />
      ) : (
        <Empty />
      )
    }

    default:
      return <Empty />
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
