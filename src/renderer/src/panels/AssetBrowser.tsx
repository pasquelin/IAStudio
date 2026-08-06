import { mdiFormatListBulleted, mdiImageMultipleOutline, mdiViewGridOutline } from '@mdi/js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { cn } from '@/design/cn'
import { infobulleSimple } from '@/design/infobulle'
import { ToolButton } from '@/design/ToolButton'
import { EtatVide } from './EtatVide'

export type AffichageAssets = 'grille' | 'liste'

const infobulle = infobulleSimple()
const TAILLE_VIGNETTE = 96
const HAUTEUR_LIGNE = 26

export type AssetBrowserProps = {
  assets?: Asset[]
}

/**
 * Bibliothèque d'assets, à la place d'un content browser Unreal : bande basse, deux
 * affichages, et une grille virtualisée — un projet fourni compte des milliers de vignettes.
 */
export function AssetBrowser({ assets = [] }: AssetBrowserProps) {
  const { t } = useTranslation()
  const [affichage, setAffichage] = useState<AffichageAssets>('grille')
  const defilement = useRef<HTMLDivElement>(null)

  return (
    <div className="bg-base flex h-full flex-col">
      <div className="border-bordure flex h-8 shrink-0 items-center gap-0.5 border-b px-1.5">
        <ToolButton
          icone={mdiViewGridOutline}
          libelle={t('assets.affichageGrille')}
          infobulle={infobulle}
          actif={affichage === 'grille'}
          onClick={() => setAffichage('grille')}
        />
        <ToolButton
          icone={mdiFormatListBulleted}
          libelle={t('assets.affichageListe')}
          infobulle={infobulle}
          actif={affichage === 'liste'}
          onClick={() => setAffichage('liste')}
        />
        <span className="text-texte-attenue ml-auto pr-1 text-[11px]">
          {t('assets.compte', { count: assets.length })}
        </span>
      </div>

      {assets.length === 0 ? (
        <EtatVide icone={mdiImageMultipleOutline} message={t('assets.aucun')} />
      ) : (
        <div ref={defilement} className="min-h-0 flex-1 overflow-auto p-2">
          {affichage === 'grille' ? (
            <GrilleAssets assets={assets} />
          ) : (
            <ListeAssets assets={assets} conteneur={defilement} />
          )}
        </div>
      )}
    </div>
  )
}

function GrilleAssets({ assets }: { assets: Asset[] }) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${TAILLE_VIGNETTE}px, 1fr))` }}
    >
      {assets.map(asset => (
        <figure key={asset.id} className="m-0 flex flex-col gap-1">
          <div className="border-bordure bg-surface aspect-square rounded-(--radius-sc-sm) border" />
          <figcaption className="text-texte-attenue truncate text-[11px]">{asset.nom}</figcaption>
        </figure>
      ))}
    </div>
  )
}

function ListeAssets({
  assets,
  conteneur,
}: {
  assets: Asset[]
  conteneur: React.RefObject<HTMLDivElement | null>
}) {
  const virtualiseur = useVirtualizer({
    count: assets.length,
    getScrollElement: () => conteneur.current,
    estimateSize: () => HAUTEUR_LIGNE,
    overscan: 8,
  })

  return (
    <div style={{ height: virtualiseur.getTotalSize() }} className="relative">
      {virtualiseur.getVirtualItems().map(ligne => {
        const asset = assets[ligne.index]
        if (!asset) return null
        return (
          <div
            key={asset.id}
            style={{ transform: `translateY(${ligne.start}px)`, height: ligne.size }}
            className={cn(
              'absolute inset-x-0 top-0 flex items-center gap-2 rounded-(--radius-sc-sm) px-2',
              'hover:bg-surface text-[12px]',
            )}
          >
            <span className="truncate">{asset.nom}</span>
            <span className="text-texte-attenue ml-auto shrink-0 text-[11px]">{asset.type}</span>
          </div>
        )
      })}
    </div>
  )
}
