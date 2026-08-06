import { mdiRedo, mdiUndo } from '@mdi/js'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from './cn'
import { infobulleSimple } from './infobulle'
import { resoudreSlot, type ConfigSlots } from './slots'
import { ToolButton } from './ToolButton'

export type SectionToolbar = 'outils' | 'extras' | 'annuler' | 'refaire'

export type Outil = {
  id: string
  /** Clé i18n du libellé — jamais le texte affiché. */
  cleLibelle: string
  icone: string
  raccourci?: string
  desactive?: boolean
}

export type ToolbarProps = {
  /** Outils affichés, dans l'ordre. */
  outils: Outil[]
  outilActif?: string
  surOutil: (id: string) => void
  orientation?: 'verticale' | 'horizontale'
  /** Masque (`false`) ou remplace (ReactNode) chaque section. */
  sections?: ConfigSlots<SectionToolbar>
  /** Outils de l'espace, rendus après les outils natifs et dans le même langage visuel. */
  extras?: ReactNode
  surAnnuler?: () => void
  surRefaire?: () => void
  peutAnnuler?: boolean
  peutRefaire?: boolean
  className?: string
}

const infobulle = infobulleSimple()

/**
 * Barre d'outils unique du studio, partagée par les six espaces. Chaque espace ne fournit
 * que son registre d'outils ; la géométrie suit `--sc-controle` et `--sc-bar-scale`, donc
 * le réglage de densité agit partout sans qu'aucune barre ne connaisse sa valeur.
 */
export function Toolbar({
  outils,
  outilActif,
  surOutil,
  orientation = 'verticale',
  sections,
  extras,
  surAnnuler,
  surRefaire,
  peutAnnuler = false,
  peutRefaire = false,
  className,
}: ToolbarProps) {
  const { t } = useTranslation()
  const verticale = orientation === 'verticale'
  const slotOutils = resoudreSlot(sections, 'outils')
  const slotExtras = resoudreSlot(sections, 'extras')
  const slotAnnuler = resoudreSlot(sections, 'annuler')
  const slotRefaire = resoudreSlot(sections, 'refaire')

  const separateur = (
    <span
      aria-hidden="true"
      className={cn('bg-bordure', verticale ? 'mx-1 h-px w-4/5' : 'my-1 h-4/5 w-px')}
    />
  )

  return (
    <div
      role="toolbar"
      aria-orientation={verticale ? 'vertical' : 'horizontal'}
      className={cn(
        'border-bordure bg-surface flex items-center gap-0.5 rounded-(--radius-sc-lg) border p-1',
        'shadow-(--sc-ombre-meuble)',
        verticale ? 'flex-col' : 'flex-row',
        className,
      )}
    >
      {slotOutils.visible &&
        (slotOutils.remplacement ?? (
          <Fragment>
            {outils.map(outil => (
              <ToolButton
                key={outil.id}
                icone={outil.icone}
                libelle={t(outil.cleLibelle)}
                raccourci={outil.raccourci}
                infobulle={infobulle}
                actif={outil.id === outilActif}
                disabled={outil.desactive}
                onClick={() => surOutil(outil.id)}
              />
            ))}
          </Fragment>
        ))}

      {slotExtras.visible && (slotExtras.remplacement ?? extras)}

      {(slotAnnuler.visible || slotRefaire.visible) && (surAnnuler || surRefaire) && separateur}

      {slotAnnuler.visible &&
        surAnnuler &&
        (slotAnnuler.remplacement ?? (
          <ToolButton
            icone={mdiUndo}
            libelle={t('actions.annuler')}
            raccourci="⌘Z"
            infobulle={infobulle}
            disabled={!peutAnnuler}
            onClick={surAnnuler}
          />
        ))}

      {slotRefaire.visible &&
        surRefaire &&
        (slotRefaire.remplacement ?? (
          <ToolButton
            icone={mdiRedo}
            libelle={t('actions.retablir')}
            raccourci="⇧⌘Z"
            infobulle={infobulle}
            disabled={!peutRefaire}
            onClick={surRefaire}
          />
        ))}
    </div>
  )
}
