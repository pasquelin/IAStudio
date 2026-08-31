import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/components/ToolButton'
import type { TooltipFactory } from '@/helpers/tooltip'
import type { TrackFlag } from '../trackFlags'

export type TrackFlagButtonProps = {
  flag: TrackFlag
  /** How the switch reads now — one track's own value, or every channel of a subject at once. */
  on: boolean
  /** What the switch is named after: the track, the subject. */
  name: string
  /** From the host, never from the button: the column opens right, the inspector left. */
  tooltip: TooltipFactory
  /**
   * Handed what the switch should BECOME, not asked to flip it: a subject whose channels
   * disagree turns fully on, rather than each channel going its own way.
   */
  onToggle: (next: boolean) => void
}

/**
 * One of the three switches a track carries, for the three surfaces that offer them — the header
 * column, the animation subjects, the inspector. `TRACK_FLAGS` only ever held the table, which is
 * how a switch came to look different depending on where it was found.
 */
export function TrackFlagButton({ flag, on, name, tooltip, onToggle }: TrackFlagButtonProps) {
  const { t } = useTranslation()

  return (
    <ToolButton
      icon={flag.iconFor(on)}
      label={t(flag.labelKey, { name })}
      tooltip={tooltip}
      variant="header"
      active={on}
      onClick={() => onToggle(!on)}
    />
  )
}
