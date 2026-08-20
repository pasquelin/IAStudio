import { useTranslation } from 'react-i18next'
import { DocumentsMessage } from './DocumentsMessage'

/** What an empty centre shows. */
export function DocumentsHome() {
  const { t } = useTranslation()
  return <DocumentsMessage message={t('documents.none')} />
}
