import { useTranslation } from 'react-i18next'
import { PropertyGroup, PropertyRow } from '@/design/PropertyRow'
import { setClipFade, setClipGain, setClipSpeed } from '@/engines/timeline/commands'
import { formatDuration, formatTimecode } from '@/engines/timeline/timecode'
import {
  clipEnd,
  MAX_GAIN_DB,
  MAX_SPEED,
  MIN_GAIN_DB,
  MIN_SPEED,
  trackOfClip,
  type Clip,
  type SequenceState,
} from '@/engines/timeline/timeline-state'
import { useAssets } from '@/stores/assets'
import { useSequences } from '@/stores/sequences'
import { NumberField } from './NumberField'

export type ClipInspectorProps = { documentId: string; sequence: SequenceState; clip: Clip }

/** Seconds are what a fade is set in; the model counts microseconds. */
const SECOND = 1_000_000

/**
 * One clip of the montage. Every control writes a command, so each change is one step of the
 * document's own undo — the same stack the strip pushes to.
 */
export function ClipInspector({ documentId, sequence, clip }: ClipInspectorProps) {
  const { t } = useTranslation()
  const name = useAssets(
    state => state.items.find(asset => asset.id === clip.assetId)?.name ?? clip.assetId,
  )

  const track = trackOfClip(sequence, clip.id)
  const run = useSequences.getState().runCommand
  const audio = track?.kind === 'audio'

  return (
    <div className="overflow-auto">
      <PropertyGroup title={t('inspector.clip')}>
        <PropertyRow label={t('inspector.source')}>{name}</PropertyRow>
        {track && <PropertyRow label={t('inspector.track')}>{track.name}</PropertyRow>}
        <PropertyRow label={t('inspector.start')}>
          {formatTimecode(clip.start, sequence.settings)}
        </PropertyRow>
        <PropertyRow label={t('inspector.end')}>
          {formatTimecode(clipEnd(clip), sequence.settings)}
        </PropertyRow>
        <PropertyRow label={t('inspector.duration')}>{formatDuration(clip.duration)}</PropertyRow>
        <PropertyRow label={t('inspector.inPoint')}>
          {formatTimecode(clip.inPoint, sequence.settings)}
        </PropertyRow>
      </PropertyGroup>

      <PropertyGroup title={t('inspector.shaping')}>
        <PropertyRow label={t('inspector.fadeIn')}>
          <NumberField
            label={t('inspector.fadeIn')}
            value={clip.fadeIn / SECOND}
            min={0}
            step={0.1}
            unit="s"
            onCommit={value =>
              run(documentId, setClipFade(clip.id, 'in', Math.round(value * SECOND)))
            }
          />
        </PropertyRow>
        <PropertyRow label={t('inspector.fadeOut')}>
          <NumberField
            label={t('inspector.fadeOut')}
            value={clip.fadeOut / SECOND}
            min={0}
            step={0.1}
            unit="s"
            onCommit={value =>
              run(documentId, setClipFade(clip.id, 'out', Math.round(value * SECOND)))
            }
          />
        </PropertyRow>
        <PropertyRow label={t('inspector.speed')}>
          <NumberField
            label={t('inspector.speed')}
            value={clip.speed}
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={0.05}
            unit="×"
            onCommit={value => run(documentId, setClipSpeed(clip.id, value))}
          />
        </PropertyRow>
        {/* Gain belongs to sound: offering it on a picture clip would promise something the
            engine has nothing to apply it to. */}
        {audio && (
          <PropertyRow label={t('inspector.gain')}>
            <NumberField
              label={t('inspector.gain')}
              value={clip.gain}
              min={MIN_GAIN_DB}
              max={MAX_GAIN_DB}
              step={0.5}
              unit="dB"
              onCommit={value => run(documentId, setClipGain(clip.id, value))}
            />
          </PropertyRow>
        )}
      </PropertyGroup>
    </div>
  )
}
