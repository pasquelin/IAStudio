import { useTranslation } from 'react-i18next'
import { PropertyGroup, PropertyRow } from '@/design/PropertyRow'
import {
  clampTrackHeight,
  MAX_TRACK_HEIGHT,
  MIN_TRACK_HEIGHT,
  updateTrack,
  type SequenceState,
  type Track,
} from '@/engines/timeline/timeline-state'
import { useSequences } from '@/stores/sequences'
import { NumberField } from './NumberField'

export type TrackInspectorProps = { documentId: string; sequence: SequenceState; track: Track }

/**
 * One track. Its state is how one works rather than what one made, so none of it goes on the
 * undo stack — the same rule the header column follows, and for the same reason.
 */
export function TrackInspector({ documentId, sequence, track }: TrackInspectorProps) {
  const { t } = useTranslation()

  const write = (change: (current: Track) => Track): void => {
    useSequences.getState().replace(documentId, updateTrack(sequence, track.id, change))
  }

  const clips = track.clips.length

  return (
    <div className="overflow-auto">
      <PropertyGroup title={t('inspector.track')}>
        <PropertyRow label={t('inspector.name')}>{track.name}</PropertyRow>
        <PropertyRow label={t('inspector.kind')}>{t(`inspector.kind_${track.kind}`)}</PropertyRow>
        <PropertyRow label={t('inspector.clips')}>{clips}</PropertyRow>
      </PropertyGroup>

      <PropertyGroup title={t('inspector.state')}>
        <PropertyRow label={t('inspector.muted')}>
          <input
            type="checkbox"
            aria-label={t('inspector.muted')}
            checked={track.muted}
            onChange={event => write(current => ({ ...current, muted: event.target.checked }))}
          />
        </PropertyRow>
        <PropertyRow label={t('inspector.soloed')}>
          <input
            type="checkbox"
            aria-label={t('inspector.soloed')}
            checked={track.solo}
            onChange={event => write(current => ({ ...current, solo: event.target.checked }))}
          />
        </PropertyRow>
        <PropertyRow label={t('inspector.locked')}>
          <input
            type="checkbox"
            aria-label={t('inspector.locked')}
            checked={track.locked}
            onChange={event => write(current => ({ ...current, locked: event.target.checked }))}
          />
        </PropertyRow>
        <PropertyRow label={t('inspector.height')}>
          <NumberField
            label={t('inspector.height')}
            value={track.height}
            min={MIN_TRACK_HEIGHT}
            max={MAX_TRACK_HEIGHT}
            step={4}
            unit="px"
            onCommit={value => write(current => ({ ...current, height: clampTrackHeight(value) }))}
          />
        </PropertyRow>
      </PropertyGroup>
    </div>
  )
}
