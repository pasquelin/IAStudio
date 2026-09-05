import { useTranslation } from 'react-i18next'
import { WelcomeMark } from './WelcomeMark'

/**
 * The window's identity, above the carousel and mounted ONCE. It rode inside the slides until this
 * lot: six copies of the same picture in the document, the reader watching the mark slide away and
 * come back on every step, and `getByRole('img')` finding six of them.
 *
 * NOT a dragged bar, though it sits where one would: `one-window-title-bar.test.ts` reserves that
 * to `WindowTitleBar`, and this window carries none. Frameless and unmovable is the state it was
 * already in — a handle for it is a decision about the window, not about its masthead.
 */
export function WelcomeMasthead() {
  const { t } = useTranslation()
  return (
    <header className="flex shrink-0 flex-col items-center gap-1.5 px-10 pt-5 pb-3">
      <WelcomeMark />
      {/* Padded by the tracking it carries: the space sits to the RIGHT of the last letter, so a
          centred line reads half a step left of the mark above it. */}
      <p className="tracking-mark pl-(--tracking-mark) text-base font-semibold uppercase">
        {t('app.name')}
      </p>
    </header>
  )
}
