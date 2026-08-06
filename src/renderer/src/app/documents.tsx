import { mdiFileOutline } from '@mdi/js'
import type { IDockviewPanelProps } from 'dockview-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/panels/EmptyState'

/**
 * Composants de documents remis à Dockview. Les documents éditables (image, scène, séquence)
 * s'y ajouteront avec leurs moteurs ; pour l'instant, seule la page d'accueil existe.
 */
export const DOCUMENT_COMPONENTS: Record<string, FC<IDockviewPanelProps>> = {
  home: () => <Home />,
}

function Home() {
  const { t } = useTranslation()
  return <EmptyState icon={mdiFileOutline} message={t('documents.none')} />
}
