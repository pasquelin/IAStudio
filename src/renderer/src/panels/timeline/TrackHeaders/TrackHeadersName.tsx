import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { renameTrack } from '@/engines/timeline/commands'
import type { Track } from '@/engines/timeline/timeline-state'
import { cn } from '@/helpers/cn'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { InlineRename } from '@/design/InlineRename'
import { useSequences } from '@/stores/sequences'

export function TrackHeadersName({
  documentId,
  track,
  dimmed,
}: {
  documentId: string
  track: Track
  dimmed: boolean
}) {
  const { t } = useTranslation()
  const [renaming, setRenaming] = useState(false)

  if (renaming) {
    return (
      <InlineRename
        value={track.name}
        label={t('timeline.rename')}
        // The name shares its row with the three toggles under it: measured on screen, the row
        // holds 48px of content and the toggles alone take 28.
        gauge="inline"
        // Guarded, because the field commits the ORIGINAL name on Escape: without it an
        // abandoned edit lands on the undo stack, and the next ⌘Z visibly does nothing.
        onCommit={name => {
          setRenaming(false)
          if (name !== track.name)
            useSequences.getState().runCommand(documentId, renameTrack(track.id, name))
        }}
      />
    )
  }

  return (
    <span
      {...TIP_RIGHT(t('timeline.renameHint'))}
      className={cn('text-tiny cursor-text truncate', dimmed ? 'text-muted' : 'text-text')}
      onDoubleClick={() => setRenaming(true)}
    >
      {track.name}
    </span>
  )
}
