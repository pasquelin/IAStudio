import { useCallback } from 'react'
import type { CommandId } from '@shared/domain/command'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useSoundTransport } from '@/spaces/audio/useSoundTransport'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { SequenceActions } from './SequenceActions'
import { TimelineTransport } from './TimelineTransport'

export type SoundActionsProps = { documentId: string }

/**
 * What a sound montage puts on the panel's title bar: its own transport, then the montage tools.
 *
 * The transport lives HERE rather than in the panel below, and that is not an arbitrary split:
 * the Audio workspace has no monitor to hold one — its centre is the take being edited — so the
 * player has to hang off the one surface the montage always brings with it.
 */
export function SoundActions({ documentId }: SoundActionsProps) {
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
        <TimelineTransport
          playing={transport.playing}
          time={sequence.playhead}
          fps={sequence.settings.fps}
          onToggle={transport.toggle}
          onRewind={transport.rewind}
        />
      }
    />
  )
}
