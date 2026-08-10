import type { HomeSectionId } from '@shared/domain/home'
import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { Section } from './Section'
import { SectionNote } from './SectionNote'

export type RefusedSectionProps = {
  id: HomeSectionId
  title: string
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
export function RefusedSection({ id, title, message, onRetry }: RefusedSectionProps) {
  const { t } = useTranslation()

  return (
    <Section id={id} title={title} actions={<Button onClick={onRetry}>{t('home.retry')}</Button>}>
      <SectionNote>{message ?? t('home.refused')}</SectionNote>
    </Section>
  )
}
