import { useTranslation } from 'react-i18next'
import { bindingOf } from '@shared/domain/command'
import type { SearchHit } from '@shared/domain/settingsSearch'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { useBindingOverrides } from '@/stores/bindings'
import { WINDOW_HELP, WINDOW_ROW_BUTTON } from '@/components/windowStyles'
import { cn } from '@/helpers/cn'

/** A hit that is not a setting: a button, or a command with the key it answers to. */
export function SettingsWindowResultRow({ hit, onGo }: { hit: SearchHit; onGo: () => void }) {
  const { t } = useTranslation()
  const label = useShortcutLabel()
  const overrides = useBindingOverrides()

  if (hit.kind === 'setting') return null

  const entry = hit.kind === 'action' ? hit.action : hit.command
  const key = hit.kind === 'command' ? label(bindingOf(hit.command.id, overrides)) : ''

  return (
    <button
      type="button"
      {...HINT_RIGHT(t('settings.searchResultHint'))}
      onClick={onGo}
      className={cn(WINDOW_ROW_BUTTON, 'flex-col')}
    >
      <span className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium">{t(entry.titleKey)}</span>
        {key && <span className="shrink-0 font-mono text-xs">{key}</span>}
      </span>
      <span className={WINDOW_HELP}>{t(entry.helpKey)}</span>
    </button>
  )
}
