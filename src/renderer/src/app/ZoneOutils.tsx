import { mdiClose, mdiWindowMinimize } from '@mdi/js'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/design/cn'
import { infobulleSimple } from '@/design/infobulle'
import { ToolButton } from '@/design/ToolButton'
import { COMPOSANTS_OUTILS } from './composants-outils'
import { cleTitreOutil, estHorizontale, type IdOutil, type ZoneOutils as Zone } from './outils'

const infobulle = infobulleSimple('bottom')

export type ZoneOutilsProps = {
  zone: Zone
  outil: IdOutil
  taille: number
  reduite: boolean
  focalisee: boolean
  surFocus: () => void
  surReduire: () => void
  surFermer: () => void
}

/**
 * Fenêtre d'outil : une surface sombre arrondie posée sur la gouttière du châssis. Un seul
 * outil visible par zone — c'est le rail qui bascule, pas un onglet ; les onglets restent
 * au centre, où ils portent des noms de documents.
 */
export function ZoneOutils({
  zone,
  outil,
  taille,
  reduite,
  focalisee,
  surFocus,
  surReduire,
  surFermer,
}: ZoneOutilsProps) {
  const { t } = useTranslation()
  const { Contenu, Actions } = COMPOSANTS_OUTILS[outil]
  const titre = t(cleTitreOutil(outil))
  const couche = estHorizontale(zone)

  return (
    <Surface
      aria-label={titre}
      onPointerDownCapture={surFocus}
      style={reduite ? undefined : couche ? { height: taille } : { width: taille }}
      className={cn(focalisee && 'ring-accent/30 ring-1', reduite && 'shrink-0')}
    >
      <EnteteSurface titre={titre}>
        {Actions !== undefined && (
          <>
            <Actions />
            <span aria-hidden="true" className="bg-bordure mx-1 h-4 w-px" />
          </>
        )}
        <ToolButton
          icone={mdiWindowMinimize}
          libelle={t('actions.reduire')}
          infobulle={infobulle}
          tailleIcone={14}
          className="size-6"
          onClick={surReduire}
        />
        <ToolButton
          icone={mdiClose}
          libelle={t('actions.retirerModule')}
          infobulle={infobulle}
          tailleIcone={14}
          className="size-6"
          onClick={surFermer}
        />
      </EnteteSurface>
      {!reduite && (
        <div className="min-h-0 flex-1 overflow-auto">
          <Contenu />
        </div>
      )}
    </Surface>
  )
}

export function Surface({
  children,
  style,
  className,
  ...reste
}: {
  children: ReactNode
  style?: CSSProperties
} & HTMLAttributes<HTMLElement>) {
  return (
    <section
      style={style}
      className={cn(
        'bg-base flex min-h-0 shrink-0 flex-col overflow-hidden rounded-(--radius-sc-lg)',
        className,
      )}
      {...reste}
    >
      {children}
    </section>
  )
}

export function EnteteSurface({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <header className="flex h-(--sc-entete) shrink-0 items-center gap-1 pr-1.5 pl-3">
      <span className="text-texte truncate text-[13px] font-semibold">{titre}</span>
      <span className="ml-auto flex items-center gap-0.5">{children}</span>
    </header>
  )
}
