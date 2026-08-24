import { mdiLightbulbOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { AiOverview } from '@shared/domain/aiOverview'
import type { SettingsSectionId } from '@shared/domain/settings'
import { INLINE_LINK } from '@/design/styles'
import { UiIcon } from '@/design/UiIcon'
import { AI_SECTION } from '@/helpers/aiSectionLazy'
import { cn } from '@/helpers/cn'
import { formatList } from '@/helpers/format'
import { roleLabel } from '@/helpers/roleLabel'
import { HINT_TOP } from '@/helpers/tooltip'
import { useBytes } from '@/hooks/useBytes'
import { adviceOf, cloudIdsOf, type Advice, type Translate } from './inventory'

/** How many operations a sentence names before it stops and counts the rest. */
const NAMED = 3

/**
 * What would change the most, in one sentence with the way to do it.
 *
 * Ordered by what it COSTS rather than by what it unlocks: choosing among models already on the
 * disk costs nothing, installing costs gigabytes, a key costs money — so nobody is told to spend
 * before being told they already hold the answer.
 */
export function ModelInventoryAdvice({
  overview,
  onOpen,
}: {
  overview: AiOverview
  onOpen: (section: SettingsSectionId) => void
}) {
  const { t, i18n } = useTranslation()
  const bytes = useBytes()

  const advices = adviceOf(overview, cloudIdsOf(overview))
  if (advices.length === 0) return null

  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {advices.map(advice => (
        <li key={advice.kind} className="text-muted text-tiny flex items-center gap-2">
          <UiIcon path={mdiLightbulbOutline} size={14} className="shrink-0" />
          <span>{sentence(advice, t, bytes, i18n.language)}</span>
          <button
            type="button"
            {...HINT_TOP(t('home.models.adviceHint'))}
            onClick={() => onOpen(advice.kind === 'key' ? 'account' : AI_SECTION)}
            className={cn(INLINE_LINK, 'text-tiny')}
          >
            {t(`home.models.advice_${advice.kind}_action`)}
          </button>
        </li>
      ))}
    </ul>
  )
}

function sentence(
  advice: Advice,
  t: Translate,
  bytes: (value: number) => string,
  language: string,
): string {
  if (advice.kind === 'key') return t('home.models.advice_key')

  if (advice.kind === 'choose') {
    const named = advice.roles.slice(0, NAMED).map(role => roleLabel(role, t))
    const rest = advice.roles.length - named.length

    return t('home.models.advice_choose', {
      count: advice.roles.length,
      names: formatList(named, language, 'conjunction'),
      // Truncated rather than run on: four operations named in a line of advice is a paragraph.
      rest: rest > 0 ? t('home.models.andOthers', { count: rest }) : '',
    })
  }

  return t('home.models.advice_install', {
    name: advice.coverage.name,
    count: advice.coverage.employments,
    families: advice.coverage.families.map(family => t(`families.${family}`)).join(' · '),
    size: bytes(advice.coverage.diskBytes),
  })
}
