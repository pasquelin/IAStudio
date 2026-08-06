import { mdiFileOutline } from '@mdi/js'
import type { IDockviewPanelProps } from 'dockview-react'
import { useTranslation } from 'react-i18next'
import { EtatVide } from '@/panels/EtatVide'

/**
 * Composants de documents remis à Dockview. Les documents éditables (image, scène, séquence)
 * s'y ajouteront avec leurs moteurs ; pour l'instant, seule la page d'accueil existe.
 */
export const COMPOSANTS_DOCUMENTS: Record<string, React.FC<IDockviewPanelProps>> = {
  accueil: () => <Accueil />,
}

function Accueil() {
  const { t } = useTranslation()
  return <EtatVide icone={mdiFileOutline} message={t('documents.aucun')} />
}
