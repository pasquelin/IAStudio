import { mdiTuneVariant } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { EmptyState } from '@/design/EmptyState'
import { PropertyGroup, PropertyRow } from '@/design/PropertyRow'
import { clipById, trackById, type SequenceState } from '@/engines/timeline/timeline-state'
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
  const selection = useSelection(state => state.selection)
  const documentId = useDocuments(state => activeIdOfKind(state, 'sequence'))
  const sequence = useSequences(state => (documentId ? sequenceOf(state, documentId) : null))
  const assets = useAssets(state => state.items)

  if (selection.kind === 'asset') {
    const chosen = assets.filter(asset => selection.ids.includes(asset.id))
    if (chosen.length === 0) return <Empty />
    return <AssetSelection assets={chosen} />
  }

  if (selection.kind === 'clip' && documentId && sequence) {
    return <ClipFace documentId={documentId} sequence={sequence} />
  }

  if (selection.kind === 'track' && documentId && sequence) {
    const track = trackById(sequence, selection.id)
    if (!track) return <Empty />
    return <TrackInspector documentId={documentId} sequence={sequence} track={track} />
  }

  return <Empty />
}

function Empty() {
  const { t } = useTranslation()
  return <EmptyState icon={mdiTuneVariant} message={t('inspector.empty')} />
}

function ClipFace({ documentId, sequence }: { documentId: string; sequence: SequenceState }) {
  const clip = sequence.selectedId ? clipById(sequence, sequence.selectedId) : null
  if (!clip) return <Empty />
  return <ClipInspector documentId={documentId} sequence={sequence} clip={clip} />
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

/** Kibibytes, like every file manager on every desktop the studio runs on. */
export function formatBytes(bytes: number): string {
  const units = ['o', 'Kio', 'Mio', 'Gio']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
