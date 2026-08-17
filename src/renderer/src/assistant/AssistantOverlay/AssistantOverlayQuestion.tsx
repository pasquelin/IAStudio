import { useTranslation } from 'react-i18next'
import { assistantAction } from '@shared/domain/assistant'
import { Button } from '@/design/Button'
import { HINT_TOP } from '@/helpers/tooltip'
import { useAssistant } from '@/stores/assistant'
import { formatUnits } from '@/usage/format'
import type { ConfirmRequest } from '../confirm'
import { OVERLAY_CARD } from './overlayStyles'

/**
 * The yes-or-no, with what it engages stated first.
 *
 * A figure is quoted only when there is one: an upload has no price, and `null` means the API
 * declined to give one — said as such rather than filled in with a guess.
 */
export function AssistantOverlayQuestion({ request }: { request: ConfirmRequest }) {
  const { t, i18n } = useTranslation()
  const action = assistantAction(request.action)
  const answer = useAssistant(state => state.answer)

  const reason = (): string => {
    if (request.commitment === 'files') return t('assistant.confirm.files')
    if (request.commitment === 'asset') return t('assistant.confirm.asset')
    if (typeof request.estimate !== 'number') return t('assistant.confirm.unknownCost')

    return t('assistant.confirm.credits', {
      cost: t('generation.estimatedCost', {
        units: formatUnits(request.estimate, i18n.language),
      }),
    })
  }

  return (
    <div className={OVERLAY_CARD}>
      <p className="text-text m-0 text-xs font-medium">
        {action ? t(action.titleKey) : request.action}
      </p>
      <p className="text-muted text-mini m-0">{reason()}</p>

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          onClick={() => answer(true)}
          {...HINT_TOP(t('assistant.confirm.yesHint'))}
        >
          {t('assistant.confirm.yes')}
        </Button>
        <Button onClick={() => answer(false)} {...HINT_TOP(t('assistant.confirm.noHint'))}>
          {t('assistant.confirm.no')}
        </Button>
      </div>
    </div>
  )
}
