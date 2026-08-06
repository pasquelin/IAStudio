import { mdiFileOutline } from '@mdi/js'
import type { IDockviewPanelProps } from 'dockview-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/panels/EmptyState'

/**
 * Document components handed to Dockview. Editable documents (image, scene, sequence) will be
 * added here along with their engines; for now only the home page exists.
 */
export const DOCUMENT_COMPONENTS: Record<string, FC<IDockviewPanelProps>> = {
  home: () => <Home />,
}

function Home() {
  const { t } = useTranslation()
  return <EmptyState icon={mdiFileOutline} message={t('documents.none')} />
}
