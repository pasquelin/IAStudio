import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BoutonsFenetre } from '@/design/BoutonsFenetre'
import { cn } from '@/design/cn'
import { UiIcon } from '@/design/UiIcon'
import { cleLibelleEspace, ESPACES, type IdEspace } from './espaces'

/**
 * `app-region` n'est pas typé par React : la barre entière est saisissable, et chaque
 * contrôle doit explicitement repasser en `no-drag`, sinon il devient incliquable.
 */
const SAISISSABLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const CLIQUABLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

export type TitleBarProps = {
  espaceActif: IdEspace
  surEspace: (espace: IdEspace) => void
  /** Actions globales alignées à droite : recherche, exécution, compte. */
  actions?: ReactNode
}

/**
 * Chrome custom : les feux de circulation restent natifs (`titleBarStyle: 'hiddenInset'`),
 * la barre porte les espaces de travail. On récupère la hauteur d'une barre de titre, et
 * l'application ne ressemble pas à une page web dans un cadre.
 */
export function TitleBar({ espaceActif, surEspace, actions }: TitleBarProps) {
  const { t } = useTranslation()

  return (
    <header
      style={SAISISSABLE}
      // `pl-20` dégage les feux de circulation natifs, dont le centre est à 14px du haut :
      // une hauteur de 44px les aligne au milieu de la barre.
      className="flex shrink-0 items-center gap-2 pt-2 pr-6 pb-1 pl-24 text-[13px]"
    >
      <div style={CLIQUABLE}>
        <BoutonsFenetre />
      </div>

      <nav
        aria-label={t('espaces.navigation')}
        style={CLIQUABLE}
        className="flex items-center gap-1"
      >
        {ESPACES.map(espace => (
          <button
            key={espace.id}
            type="button"
            aria-current={espace.id === espaceActif ? 'page' : undefined}
            onClick={() => surEspace(espace.id)}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-(--radius-sc-md) border-none px-3 py-1',
              'text-texte-attenue bg-transparent transition-colors',
              'hover:bg-elevated/60 hover:text-texte',
              espace.id === espaceActif && 'bg-elevated text-texte',
            )}
          >
            <UiIcon chemin={espace.icone} taille={16} />
            {t(cleLibelleEspace(espace.id))}
          </button>
        ))}
      </nav>

      {actions !== undefined && (
        <div style={CLIQUABLE} className="ml-auto flex items-center gap-1">
          {actions}
        </div>
      )}
    </header>
  )
}
