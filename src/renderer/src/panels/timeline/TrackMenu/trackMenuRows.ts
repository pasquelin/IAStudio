import { mdiArrowDown, mdiArrowUp, mdiDeleteOutline } from '@mdi/js'
import type { TFunction } from 'i18next'
import type { MenuRowSpec } from '@/components/menuRows'
import { moveTrack, removeTrack } from '@/engines/timeline/commands'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { useSequences } from '@/stores/sequences'

export type TrackMenuInput = {
  documentId: string
  trackId: string
  /** Whether the row has anywhere to go: the first cannot rise, the last cannot fall. */
  canRise: boolean
  canFall: boolean
}

/**
 * What can be done to a track, as rows — the three edits an add button cannot carry.
 *
 * Read by two things, on the style row's pattern: the right-click menu and the row's own button.
 * A right-click is not a keyboard gesture, so the button is what makes these reachable without a
 * mouse. Data rather than JSX so the button COUNTS them instead of carrying the figure by hand.
 */
export function trackMenuRows(
  t: TFunction,
  { documentId, trackId, canRise, canFall }: TrackMenuInput,
): MenuRowSpec[] {
  const move = (by: number) => (close: () => void) => {
    useSequences.getState().runCommand(documentId, moveTrack(trackId, by))
    close()
  }

  return [
    {
      key: 'up',
      label: t('timeline.moveTrackUp'),
      icon: mdiArrowUp,
      disabled: !canRise,
      tip: HINT_RIGHT(t('timeline.moveTrackUpHint')),
      onSelect: move(-1),
    },
    {
      key: 'down',
      label: t('timeline.moveTrackDown'),
      icon: mdiArrowDown,
      disabled: !canFall,
      tip: HINT_RIGHT(t('timeline.moveTrackDownHint')),
      onSelect: move(1),
    },
    {
      key: 'remove',
      label: t('timeline.removeTrack'),
      icon: mdiDeleteOutline,
      tip: HINT_RIGHT(t('timeline.removeTrackHint')),
      onSelect: close => {
        useSequences.getState().runCommand(documentId, removeTrack(trackId))
        close()
      },
    },
  ]
}
