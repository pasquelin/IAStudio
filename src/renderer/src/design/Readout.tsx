import { useTranslation } from 'react-i18next'
import { formatDecimal } from '@/helpers/format'
import { TIP_LEFT } from '@/helpers/tooltip'
import { FIELD_READOUT } from './styles'

/** How many decimals a panel can hold. Past this the number widens the panel it sits in. */
const DECIMALS = 2

/**
 * What the tooltip may spend. Not an `Intl` limit — it takes a hundred — but what a double is
 * worth: past this the digits are the ones the format invented. A value under `1e-20` therefore
 * reads `0` here, which no coordinate this studio holds ever is.
 */
const EXACT_DECIMALS = 20

/**
 * The number beside a track, cut to what the layout can hold.
 *
 * An angle in radians reads `0.5235987755982988`. Shown whole it pushed the inspector wider than
 * itself and gave the panel a horizontal scrollbar — for digits nobody reads. The exact value is
 * not lost: it rides in the tooltip, and only when something was actually cut, since a tooltip
 * repeating what is already on screen is noise.
 */
export function Readout({ values }: { values: readonly number[] }) {
  const { i18n } = useTranslation()
  const shown = values.map(value => formatDecimal(value, i18n.language, DECIMALS)).join('–')
  // Exact, and in the reader's language too: the tooltip is the same number said in full, not
  // another number — and it is what a screen reader speaks.
  const exact = values.map(value => formatDecimal(value, i18n.language, EXACT_DECIMALS)).join('–')

  // The tooltip's `aria-label` rides along on purpose: a screen reader then hears the exact
  // value, which is the one thing the rounded text on screen cannot give it.
  return (
    <output className={FIELD_READOUT} {...(shown === exact ? {} : TIP_LEFT(exact))}>
      {shown}
    </output>
  )
}
