import { useTranslation } from 'react-i18next'
import { NumberField } from '@/components/NumberField'
import { PropertySection } from '@/components/PropertySection'
import { PropertyRow } from '@/components/PropertyRow'
import { setClipFade, setClipGain, setClipSpeed } from '@/engines/timeline/commands'
import { formatDuration, formatTimecode } from '@/engines/timeline/timecode'
import {
  clipEnd,
  MAX_GAIN_DB,
  MAX_SPEED,
  MIN_GAIN_DB,
  MIN_SPEED,
  SECOND,
  trackOfClip,
  type Clip,
  type SequenceState,
} from '@/engines/timeline/timelineState'
import { assetsById, useAssets } from '@/stores/assets'
import { useSequenceEdit } from '@/hooks/useSequenceEdit'

export type ClipInspectorProps = { documentId: string; sequence: SequenceState; clip: Clip }

/**
 * One clip of the montage. Every control writes a command, so each change is one step of the
 * document's own undo — the same stack the strip pushes to.
 */
export function ClipInspector({ documentId, sequence, clip }: ClipInspectorProps) {
  const { t } = useTranslation()
  // The name rather than the index: subscribing to the map re-renders on every catalogue
  // refresh, and a job finishing renames nothing here.
  const name = useAssets(state => assetsById(state).get(clip.assetId)?.name) ?? clip.assetId

  const track = trackOfClip(sequence, clip.id)
  const edit = useSequenceEdit(documentId)
  const audio = track?.kind === 'audio'

  return (
    <>
      <PropertySection title={t('inspector.clip')} scId="clip">
        <PropertyRow label={t('inspector.source')}>{name}</PropertyRow>
        {track && <PropertyRow label={t('inspector.track')}>{track.name}</PropertyRow>}
        <PropertyRow label={t('inspector.start')}>
          {formatTimecode(clip.start, sequence.settings.fps)}
        </PropertyRow>
        <PropertyRow label={t('inspector.end')}>
          {formatTimecode(clipEnd(clip), sequence.settings.fps)}
        </PropertyRow>
        <PropertyRow label={t('inspector.duration')}>{formatDuration(clip.duration)}</PropertyRow>
        <PropertyRow label={t('inspector.inPoint')}>
          {formatTimecode(clip.inPoint, sequence.settings.fps)}
        </PropertyRow>
      </PropertySection>

      <PropertySection title={t('inspector.shaping')} scId="clip.shaping">
        <NumberField
          label={t('inspector.fadeIn')}
          scId="clip.fadeIn"
          value={clip.fadeIn / SECOND}
          min={0}
          step={0.1}
          onChange={value => edit.run(setClipFade(clip.id, 'in', Math.round(value * SECOND)))}
          {...edit.gesture}
        />
        <NumberField
          label={t('inspector.fadeOut')}
          scId="clip.fadeOut"
          value={clip.fadeOut / SECOND}
          min={0}
          step={0.1}
          onChange={value => edit.run(setClipFade(clip.id, 'out', Math.round(value * SECOND)))}
          {...edit.gesture}
        />
        <NumberField
          label={t('inspector.speed')}
          scId="clip.speed"
          value={clip.speed}
          min={MIN_SPEED}
          max={MAX_SPEED}
          step={0.05}
          onChange={value => edit.run(setClipSpeed(clip.id, value))}
          {...edit.gesture}
        />
        {/* Gain belongs to sound: offering it on a picture clip would promise something the
            engine has nothing to apply it to. */}
        {audio && (
          <NumberField
            label={t('inspector.gain')}
            scId="clip.gain"
            value={clip.gain}
            min={MIN_GAIN_DB}
            max={MAX_GAIN_DB}
            step={0.5}
            onChange={value => edit.run(setClipGain(clip.id, value))}
            {...edit.gesture}
          />
        )}
      </PropertySection>
    </>
  )
}
