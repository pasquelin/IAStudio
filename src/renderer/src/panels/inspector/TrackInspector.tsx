import { useTranslation } from 'react-i18next'
import { NumberField } from '@/design/NumberField'
import { PropertyGroup, PropertyRow } from '@/design/PropertyRow'
import { ToolButton } from '@/design/ToolButton'
import { TIP_LEFT } from '@/helpers/tooltip'
import { TRACK_FLAGS } from '@/panels/timeline/track-flags'
import {
  clampTrackHeight,
  MAX_TRACK_HEIGHT,
  MIN_TRACK_HEIGHT,
  type Track,
} from '@/engines/timeline/timeline-state'
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
      <PropertyGroup title={t('inspector.track')}>
        <PropertyRow label={t('inspector.name')}>{track.name}</PropertyRow>
        <PropertyRow label={t('inspector.kind')}>{t(`inspector.kind_${track.kind}`)}</PropertyRow>
        <PropertyRow label={t('inspector.clips')}>{clips}</PropertyRow>
      </PropertyGroup>

      <PropertyGroup title={t('inspector.state')}>
        {/* The same control as the header column, from the same table: a switch that looks
            different depending on where it is found reads as two different switches. */}
        {TRACK_FLAGS.map(flag => (
          <PropertyRow key={flag.key} label={t(`inspector.${flag.key}`)}>
            <ToolButton
              icon={flag.iconFor(track[flag.key])}
              label={t(flag.labelKey, { name: track.name })}
              tooltip={TIP_LEFT}
              variant="header"
              active={track[flag.key]}
              onClick={() => write(current => ({ ...current, [flag.key]: !current[flag.key] }))}
            />
          </PropertyRow>
        ))}
        <NumberField
          label={t('inspector.height')}
          value={track.height}
          min={MIN_TRACK_HEIGHT}
          max={MAX_TRACK_HEIGHT}
          step={4}
          onChange={value => write(current => ({ ...current, height: clampTrackHeight(value) }))}
        />
      </PropertyGroup>
    </>
  )
}
