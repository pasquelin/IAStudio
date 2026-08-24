import { useTranslation } from 'react-i18next'
import { WINDOW_CAPTION, WINDOW_GROUP_LABEL, WINDOW_HELP } from '@/design/windowStyles'
import { cn } from '@/helpers/cn'
import { useMcpState } from '@/hooks/useMcpState'
import { SETTING_COLUMN } from '../settingStyles'

/** The one list skin these three runs share, so they cannot drift apart on the same screen. */
const LIST = 'list-inside space-y-1'

/**
 * What no descriptor can express about the door onto this machine: whether it is actually open,
 * on which port, and what to do with that.
 */
export function McpSettings() {
  const { t } = useTranslation()
  const { port } = useMcpState()

  return (
    <div className={cn(SETTING_COLUMN, 'mt-6 gap-6')}>
      <p className={WINDOW_HELP}>
        {port === null ? t('settings.mcpClosed') : t('settings.mcpListening', { port })}
      </p>

      <section>
        <h3 className={WINDOW_GROUP_LABEL}>{t('settings.mcpHowTo')}</h3>
        <ol className={cn(WINDOW_CAPTION, LIST, 'list-decimal')}>
          <li>{t('settings.mcpStepOpen')}</li>
          <li>{t('settings.mcpStepCopy')}</li>
          <li>{t('settings.mcpStepPaste')}</li>
        </ol>
        <p className={cn(WINDOW_HELP, 'mt-2')}>{t('settings.mcpEachLaunch')}</p>
      </section>

      <section>
        <h3 className={WINDOW_GROUP_LABEL}>{t('settings.mcpExamples')}</h3>
        <ul className={cn(WINDOW_CAPTION, LIST, 'list-disc')}>
          <li>{t('settings.mcpExampleGenerate')}</li>
          <li>{t('settings.mcpExampleTidy')}</li>
          <li>{t('settings.mcpExampleScene')}</li>
        </ul>
      </section>

      <section>
        <h3 className={WINDOW_GROUP_LABEL}>{t('settings.mcpGuards')}</h3>
        <ul className={cn(WINDOW_CAPTION, LIST, 'list-disc')}>
          <li>{t('settings.mcpGuardLocal')}</li>
          <li>{t('settings.mcpGuardToken')}</li>
          <li>{t('settings.mcpGuardOrigin')}</li>
          <li>{t('settings.mcpGuardConsent')}</li>
        </ul>
      </section>
    </div>
  )
}
