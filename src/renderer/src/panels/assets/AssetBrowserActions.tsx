import { useTranslation } from 'react-i18next'
import { HINT_BOTTOM } from '@/helpers/tooltip'
import { useAssets } from '@/stores/assets'

/**
 * The remote browser's own title row.
 *
 * One thing, and it is a number: what the panel drew. The four gestures that stood here until
 * 25 August — importing, describing, laying out a contact sheet, sending up — were all about the
 * files this project holds, and went with them to the Explorer's menus. None of them has any
 * meaning over a library this machine has no copy of.
 *
 * The bar itself is NOT here: the panel stands in a column, where 500 px of bar in a 320 px
 * header pushed the close button out of the frame.
 */
export function AssetBrowserActions() {
  const { t } = useTranslation()
  // What the panel is drawing — both libraries and the generations in flight, filters included.
  const count = useAssets(state => state.shownCount ?? 0)

  return (
    // A hint and not a tooltip factory: the number is already on screen, and an `aria-label` over
    // it would answer to a name nobody can see (WCAG 2.5.3). What it adds is the half the number
    // cannot say — which listings it is counting.
    <span className="text-muted text-tiny mr-1" {...HINT_BOTTOM(t('assets.countHint'))}>
      {t('assets.count', { count })}
    </span>
  )
}
