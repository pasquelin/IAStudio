import { useTranslation } from 'react-i18next'
import { hiddenHomeSections, homeSections, shownHomeSection } from '@shared/domain/home'
import { INLINE_LINK } from '@/components/styles'
import { cn } from '@/helpers/cn'
import { hasApi, useSettings } from '@/stores/settings'
import { HINT_TOP } from '@/helpers/tooltip'

/**
 * The way back from hiding a section, offered where the sections are rather than in the
 * settings: a control that removes something must say where it went, or the studio grows a
 * setting whose only symptom is a shelf that stopped appearing.
 */
export function HomeViewHidden() {
  const { t } = useTranslation()
  const stored = useSettings(state => state.settings.home.sections)
  const api = useSettings(hasApi)

  const hidden = hiddenHomeSections(stored, api)
  if (hidden.length === 0) return null

  const restore = (): void => {
    const sections = hidden.reduce(
      (all, id) => shownHomeSection(all, id, true),
      homeSections(stored),
    )
    void useSettings.getState().write({ home: { sections } })
  }

  return (
    <p className="text-muted text-tiny m-0 flex items-center gap-2">
      {t('home.hidden', { count: hidden.length })}
      <button
        type="button"
        {...HINT_TOP(t('home.restoreHint'))}
        onClick={restore}
        className={cn(INLINE_LINK, 'text-tiny')}
      >
        {t('home.restore')}
      </button>
    </p>
  )
}
