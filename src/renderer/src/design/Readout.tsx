import { TIP_LEFT } from '@/helpers/tooltip'
import { FIELD_READOUT } from './styles'

/** How many decimals a panel can hold. Past this the number widens the panel it sits in. */
const DECIMALS = 2

/**
 * The number beside a track, cut to what the layout can hold.
 *
 * An angle in radians reads `0.5235987755982988`. Shown whole it pushed the inspector wider than
 * itself and gave the panel a horizontal scrollbar — for digits nobody reads. The exact value is
 * not lost: it rides in the tooltip, and only when something was actually cut, since a tooltip
 * repeating what is already on screen is noise.
 */
export function Readout({ values }: { values: readonly number[] }) {
  const shown = values.map(short).join('–')
  const exact = values.join('–')

  // The tooltip's `aria-label` rides along on purpose: a screen reader then hears the exact
  // value, which is the one thing the rounded text on screen cannot give it.
  return (
    <output className={FIELD_READOUT} {...(shown === exact ? {} : TIP_LEFT(exact))}>
      {shown}
    </output>
  )
}

/** `Number` rather than `toFixed`: 1 must stay "1" and never become "1.00". */
function short(value: number): string {
  return String(Number(value.toFixed(DECIMALS)))
}
