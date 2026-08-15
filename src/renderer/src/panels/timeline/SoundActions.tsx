import { mdiPause, mdiPlay, mdiSkipPrevious } from '@mdi/js'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { CommandId } from '@shared/domain/command'
import { Separator } from '@/design/Separator'
import { Timecode } from '@/design/Timecode'
import { ToolButton } from '@/design/ToolButton'
import { useShortcuts } from '@/hooks/useShortcuts'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { useSoundTransport } from '@/spaces/audio/useSoundTransport'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { SequenceActions } from './SequenceActions'

export type SoundActionsProps = { documentId: string }

/**
 * What a sound montage puts on the panel's title bar: its own transport, then the montage tools.
 *
 * The transport lives HERE rather than in the panel below, and that is not an arbitrary split:
 * the Audio workspace has no monitor to hold one — its centre is the take being edited — so the
 * player has to hang off the one surface the montage always brings with it.
 */
export function SoundActions({ documentId }: SoundActionsProps) {
  const { t } = useTranslation()
  const sequence = useSequences(state => sequenceOf(state, documentId))
  const transport = useSoundTransport(documentId, sequence)

  // The space bar, which nothing else in this workspace would answer: the strip leaves
  // `sequence.playPause` to the programme monitor, and Audio has no monitor to leave it to.
  const onCommand = useCallback(
    (command: CommandId) => {
      if (command === 'sequence.playPause') transport.toggle()
    },
    [transport],
  )
  useShortcuts({ scope: 'sequence', enabled: true, onCommand })

  return (
    <SequenceActions
      documentId={documentId}
      // Sound only: there is nothing here to show a picture on.
      kinds={['audio']}
      lead={
        <>
          <ToolButton
            icon={mdiSkipPrevious}
            label={t('transport.rewind')}
            tooltip={TIP_BOTTOM}
            variant="header"
            onClick={transport.rewind}
          />
          <ToolButton
            icon={transport.playing ? mdiPause : mdiPlay}
            label={transport.playing ? t('transport.pause') : t('transport.play')}
            tooltip={TIP_BOTTOM}
            variant="header"
            active={transport.playing}
            onClick={transport.toggle}
          />
          <Timecode time={sequence.playhead} fps={sequence.settings.fps} />
          <Separator />
        </>
      }
    />
  )
}
