import { mdiPause, mdiPlay, mdiSkipPrevious } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { Us } from '@shared/domain/time'
import { Separator } from '@/design/Separator'
import { Timecode } from '@/design/Timecode'
import { ToolButton } from '@/design/ToolButton'
import { TIP_BOTTOM } from '@/helpers/tooltip'

export type TimelineTransportProps = {
  playing: boolean
  /** Where the head stands, and the rate it is read at — the two the timecode is made of. */
  time: Us
  fps: number
  onToggle: () => void
  onRewind: () => void
}

/**
 * The head of a timeline's bar: back to the start, play, and the time the head stands at.
 *
 * ONE component for the three bands, and that is the point. The montage, the sound montage and
 * the dope sheet had each written this row: same two glyphs, same gauge, but announced under two
 * different names, and one band carried no time at all while the two others did.
 *
 * What plays is not shared and cannot be — a scene runs its own frame loop, a montage runs the
 * `TimelineEngine` — so the state comes in as props. What every band owes the reader is the same
 * row in the same place.
 */
export function TimelineTransport({
  playing,
  time,
  fps,
  onToggle,
  onRewind,
}: TimelineTransportProps) {
  const { t } = useTranslation()

  return (
    <>
      <ToolButton
        icon={mdiSkipPrevious}
        label={t('transport.rewind')}
        tooltip={TIP_BOTTOM}
        variant="header"
        onClick={onRewind}
      />
      <ToolButton
        icon={playing ? mdiPause : mdiPlay}
        label={playing ? t('transport.pause') : t('transport.play')}
        tooltip={TIP_BOTTOM}
        variant="header"
        active={playing}
        onClick={onToggle}
      />
      <Timecode time={time} fps={fps} />
      <Separator />
    </>
  )
}
