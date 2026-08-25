import { useTranslation } from 'react-i18next'
import { HINT_BOTTOM } from '@/helpers/tooltip'
import { useAssets } from '@/stores/assets'

/**
 * The remote browser's own title row: one number, and nothing else — no gesture of this panel
 * acts on a library this machine has no copy of.
 *
 * The filter bar is NOT here: 500 px of bar in a 320 px header pushed the close button out.
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
