import { useTranslation } from 'react-i18next'
import { DENSITIES, isDensity, isTheme, THEMES } from '@shared/domain/settings'
import { useSettings } from '@/stores/settings'

export function AppearanceSettings() {
  const { t } = useTranslation()
  const appearance = useSettings(state => state.settings.appearance)
  const write = useSettings(state => state.write)

  return (
    <div className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs">
        {t('settings.theme')}
        <select
          className="select select-sm"
          value={appearance.theme}
          onChange={event => {
            const theme = event.target.value
            if (isTheme(theme)) void write({ appearance: { theme } })
          }}
        >
          {THEMES.map(theme => (
            <option key={theme} value={theme}>
              {t(theme === 'dark' ? 'settings.themeDark' : 'settings.themeLight')}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs">
        {t('settings.density')}
        <select
          className="select select-sm"
          value={appearance.density}
          onChange={event => {
            const density = event.target.value
            if (isDensity(density)) void write({ appearance: { density } })
          }}
        >
          {DENSITIES.map(density => (
            <option key={density} value={density}>
              {t(density === 'compact' ? 'settings.densityCompact' : 'settings.densityComfortable')}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
