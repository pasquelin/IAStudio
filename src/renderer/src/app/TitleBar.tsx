import { useTranslation } from 'react-i18next'
import { cn } from '@/design/cn'
import { UiIcon } from '@/design/UiIcon'
import { cleLibelleEspace, ESPACES, type IdEspace } from './espaces'

export type TitleBarProps = {
  espaceActif: IdEspace
  surEspace: (espace: IdEspace) => void
  titreDocument?: string
}

/**
 * Chrome custom : les feux de circulation restent natifs (`titleBarStyle: 'hiddenInset'`),
 * la barre porte les onglets d'espaces. On récupère la hauteur verticale d'une barre de
 * titre, et l'application ne ressemble pas à une page web dans un cadre.
 *
 * `app-region: drag` rend la barre saisissable ; chaque contrôle doit explicitement
 * repasser en `no-drag`, sinon il devient impossible à cliquer.
 */
export function TitleBar({ espaceActif, surEspace, titreDocument }: TitleBarProps) {
  const { t } = useTranslation()

  return (
    <header
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="border-bordure bg-surface flex h-11 shrink-0 items-center gap-1 border-b pr-3 pl-20"
    >
      <nav
        aria-label={t('espaces.navigation')}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex items-center gap-0.5"
      >
        {ESPACES.map(espace => (
          <button
            key={espace.id}
            type="button"
            aria-current={espace.id === espaceActif ? 'page' : undefined}
            onClick={() => surEspace(espace.id)}
            className={cn(
              'flex h-7 cursor-pointer items-center gap-1.5 rounded-(--radius-sc-md) border-none px-2.5',
              'text-texte-attenue bg-transparent text-[12px] transition-colors',
              'hover:bg-elevated hover:text-texte',
              espace.id === espaceActif && 'bg-elevated text-texte',
            )}
          >
            <UiIcon chemin={espace.icone} taille={15} />
            {t(cleLibelleEspace(espace.id))}
          </button>
        ))}
      </nav>

      {titreDocument !== undefined && (
        <span className="text-texte-attenue ml-auto truncate pl-4 text-[12px]">
          {titreDocument}
        </span>
      )}
    </header>
  )
}
