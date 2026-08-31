import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { QuietNote } from '@/components/QuietNote'
import { DEFAULT_WORKSPACE } from '@shared/domain/workspace'
import { enterWorkspace } from '../open'
import { HINT_TOP } from '@/helpers/tooltip'
import { HomeViewHidden } from './HomeViewHidden'

/** The foot of the page: one sentence, two ways on. Nobody should reach the bottom and stop. */
export function HomeViewClosing() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <QuietNote standalone>{t('home.closing.title')}</QuietNote>
      <Button
        {...HINT_TOP(t('home.closingActionHint'))}
        onClick={() => enterWorkspace(DEFAULT_WORKSPACE)}
      >
        {t('home.closing.action')}
      </Button>
      <HomeViewHidden />
    </div>
  )
}
