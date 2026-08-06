import { mdiClose } from '@mdi/js'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { infobulleSimple } from '@/design/infobulle'
import { ToolButton } from '@/design/ToolButton'
import { COMPOSANTS_OUTILS } from './composants-outils'
import { cleTitreOutil, estHorizontale, type IdOutil, type ZoneOutils as Zone } from './outils'

const infobulle = infobulleSimple()

export type ZoneOutilsProps = {
  zone: Zone
  outil: IdOutil
  taille: number
  surFermer: () => void
}

/**
 * Fenêtre d'outil : une surface sombre arrondie posée sur la gouttière du châssis. Un seul
 * outil visible par zone — c'est le rail qui bascule, pas un onglet ; les onglets restent
 * au centre, où ils portent des noms de documents.
 */
export function ZoneOutils({ zone, outil, taille, surFermer }: ZoneOutilsProps) {
  const { t } = useTranslation()
  const Contenu = COMPOSANTS_OUTILS[outil]
  const titre = t(cleTitreOutil(outil))

  return (
    <Surface
      aria-label={titre}
      style={estHorizontale(zone) ? { height: taille } : { width: taille }}
    >
      <EnteteSurface titre={titre}>
        <ToolButton
          icone={mdiClose}
          libelle={t('actions.fermer')}
          infobulle={infobulle}
          tailleIcone={13}
          className="size-5"
          onClick={surFermer}
        />
      </EnteteSurface>
      <div className="min-h-0 flex-1 overflow-auto">
        <Contenu />
      </div>
    </Surface>
  )
}

export function Surface({
  children,
  style,
  ...reste
}: {
  children: ReactNode
  style?: React.CSSProperties
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      style={style}
      className="bg-base flex min-h-0 shrink-0 flex-col overflow-hidden rounded-(--radius-sc-lg)"
      {...reste}
    >
      {children}
    </section>
  )
}

export function EnteteSurface({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <header className="flex h-(--sc-entete) shrink-0 items-center gap-1 pr-1.5 pl-3">
      <span className="text-texte truncate text-[12px] font-medium">{titre}</span>
      <span className="ml-auto flex items-center gap-0.5">{children}</span>
    </header>
  )
}
