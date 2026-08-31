import { useTranslation } from 'react-i18next'
import { NumberField } from '@/components/NumberField'
import { PropertySection } from '@/components/PropertySection'
import { PropertyRow } from '@/components/PropertyRow'
import { TIP_LEFT } from '@/helpers/tooltip'
import { TrackFlagButton } from '@/panels/timeline/TrackFlagButton'
import { TRACK_FLAGS } from '@/panels/timeline/trackFlags'
import {
  clampTrackHeight,
  MAX_TRACK_HEIGHT,
  MIN_TRACK_HEIGHT,
  type Track,
} from '@/engines/timeline/timelineState'
import { writeTrack } from '@/stores/sequences'

export type TrackInspectorProps = { documentId: string; track: Track }

/**
 * One track. Its state is how one works rather than what one made, so none of it goes on the
 * undo stack — the same rule the header column follows, and for the same reason.
 */
export function TrackInspector({ documentId, track }: TrackInspectorProps) {
  const { t } = useTranslation()

  const write = (change: (current: Track) => Track): void =>
    writeTrack(documentId, track.id, change)

  const clips = track.clips.length

  return (
    <>
      <PropertySection title={t('inspector.track')} scId="track">
        <PropertyRow label={t('inspector.name')}>{track.name}</PropertyRow>
        <PropertyRow label={t('inspector.kind')}>{t(`inspector.kind_${track.kind}`)}</PropertyRow>
        <PropertyRow label={t('inspector.clips')}>{clips}</PropertyRow>
      </PropertySection>

      <PropertySection title={t('inspector.state')} scId="track.state">
        {TRACK_FLAGS.map(flag => (
          <PropertyRow key={flag.key} label={t(`inspector.${flag.key}`)}>
            <TrackFlagButton
              flag={flag}
              on={track[flag.key]}
              name={track.name}
              tooltip={TIP_LEFT}
              onToggle={next => write(current => ({ ...current, [flag.key]: next }))}
            />
          </PropertyRow>
        ))}
        <NumberField
          label={t('inspector.height')}
          scId="track.height"
          value={track.height}
          min={MIN_TRACK_HEIGHT}
          max={MAX_TRACK_HEIGHT}
          step={4}
          onChange={value => write(current => ({ ...current, height: clampTrackHeight(value) }))}
        />
      </PropertySection>
    </>
  )
}
