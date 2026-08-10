import { mdiArrowDown, mdiArrowUp, mdiDeleteOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { moveTrack, removeTrack } from '@/engines/timeline/commands'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { useSequences } from '@/stores/sequences'

export type TrackMenuProps = {
  documentId: string
  trackId: string
  /** Whether the row has anywhere to go: the first cannot rise, the last cannot fall. */
  canRise: boolean
  canFall: boolean
  onClose: () => void
}

/**
 * What can be done to a track, as rows — the three edits an add button cannot carry.
 *
 * Rendered by two things, on `StyleMenuRows`' pattern: the right-click menu and the row's own
 * button. A right-click is not a keyboard gesture, so the button is what makes these reachable
 * without a mouse.
 */
export function TrackMenuRows({ documentId, trackId, canRise, canFall, onClose }: TrackMenuProps) {
  const { t } = useTranslation()

  const run = (by: number) => (): void => {
    useSequences.getState().runCommand(documentId, moveTrack(trackId, by))
    onClose()
  }

  return (
    <>
      <MenuRow
        label={t('timeline.moveTrackUp')}
        icon={mdiArrowUp}
        disabled={!canRise}
        tip={HINT_RIGHT(t('timeline.moveTrackUpHint'))}
        onSelect={run(-1)}
      />
      <MenuRow
        label={t('timeline.moveTrackDown')}
        icon={mdiArrowDown}
        disabled={!canFall}
        tip={HINT_RIGHT(t('timeline.moveTrackDownHint'))}
        onSelect={run(1)}
      />
      <MenuRow
        label={t('timeline.removeTrack')}
        icon={mdiDeleteOutline}
        tip={HINT_RIGHT(t('timeline.removeTrackHint'))}
        onSelect={() => {
          useSequences.getState().runCommand(documentId, removeTrack(trackId))
          onClose()
        }}
      />
    </>
  )
}

/** The same rows, at the pointer. */
export function TrackMenu({ at, ...rows }: TrackMenuProps & { at: { x: number; y: number } }) {
  return (
    <ContextMenu at={at} onClose={rows.onClose}>
      <TrackMenuRows {...rows} />
    </ContextMenu>
  )
}

/** Three, and the row's button needs to know before it draws. */
export const TRACK_MENU_ROWS = 3
