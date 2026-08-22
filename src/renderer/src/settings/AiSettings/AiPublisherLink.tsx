import { useTranslation } from 'react-i18next'
import { HINT_LEFT } from '@/helpers/tooltip'

export type AiPublisherLinkProps = {
  /** The publisher page. Shown only when it is HTTPS — `lockNavigation` refuses the rest. */
  url: string
}

/** Outward link to the model card. Lives outside the radio so a greyed row stays clickable. */
export function AiPublisherLink({ url }: AiPublisherLinkProps) {
  const { t } = useTranslation()
  if (!url.startsWith('https://')) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="link link-hover text-sm whitespace-nowrap"
      {...HINT_LEFT(t('aiModels.publisherCardHint'))}
    >
      {t('aiModels.publisherCard')}
    </a>
  )
}
