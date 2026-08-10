import type { HomeSectionId } from '@shared/domain/home'
import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { Section } from './Section'
import { SectionNote } from './SectionNote'
import { HINT_TOP } from '@/helpers/tooltip'

export type RefusedSectionProps = {
  id: HomeSectionId
  /** What did not answer, in the band's own words. The generic line stands in when it has none. */
  message?: string
  onRetry: () => void
}

/**
 * What a band draws when its read was refused: it stays, says so quietly, and offers to try.
 *
 * Written once because five bands need it and the alternative is what produced the debt — each
 * one taking itself off the page on a refusal, indistinguishably from having nothing to show.
 * A red error on a decorative band would be worse than the silence; a muted line and a button
 * is the whole of it.
 */
export function RefusedSection({ id, message, onRetry }: RefusedSectionProps) {
  const { t } = useTranslation()

  return (
    // The heading is the registry's, derived rather than passed: a band that reads its own from
    // elsewhere when it has something to show — Similar names its reference — would otherwise
    // carry two titles, and the refused one is the plain name of the section either way.
    <Section
      id={id}
      title={t(`home.sections.${id}`)}
      actions={
        <Button {...HINT_TOP(t('actions.retryHint'))} onClick={onRetry}>
          {t('home.retry')}
        </Button>
      }
    >
      <SectionNote>{message ?? t('home.refused')}</SectionNote>
    </Section>
  )
}
