import { mdiFormatListBulleted, mdiImageMultipleOutline, mdiViewGridOutline } from '@mdi/js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { cn } from '@/design/cn'
import { infobulleSimple } from '@/design/infobulle'
import { ToolButton } from '@/design/ToolButton'
import { useAssets } from '@/stores/assets'
import { EtatVide } from './EtatVide'

const infobulle = infobulleSimple('bottom')
const TAILLE_VIGNETTE = 96
const HAUTEUR_LIGNE = 26

export type AssetBrowserProps = {
  assets?: Asset[]
}

/** Actions rendues dans la barre de titre du panneau, sur la même ligne que son nom. */
export function ActionsAssetBrowser({ assets = [] }: AssetBrowserProps) {
  const { t } = useTranslation()
  const affichage = useAssets(etat => etat.affichage)
  const definirAffichage = useAssets(etat => etat.definirAffichage)

  return (
    <>
      <span className="text-texte-attenue mr-1 text-[11px]">
        {t('assets.compte', { count: assets.length })}
      </span>
      <ToolButton
        icone={mdiViewGridOutline}
        libelle={t('assets.affichageGrille')}
        infobulle={infobulle}
        tailleIcone={15}
        className="size-6"
        actif={affichage === 'grille'}
        onClick={() => definirAffichage('grille')}
      />
      <ToolButton
        icone={mdiFormatListBulleted}
        libelle={t('assets.affichageListe')}
        infobulle={infobulle}
        tailleIcone={15}
        className="size-6"
        actif={affichage === 'liste'}
        onClick={() => definirAffichage('liste')}
      />
    </>
  )
}

/**
 * Bibliothèque d'assets, à la place d'un content browser Unreal : bande basse, deux
 * affichages, et une grille virtualisée — un projet fourni compte des milliers de vignettes.
 */
export function AssetBrowser({ assets = [] }: AssetBrowserProps) {
  const { t } = useTranslation()
  const affichage = useAssets(etat => etat.affichage)
  const defilement = useRef<HTMLDivElement>(null)

  if (assets.length === 0) {
    return <EtatVide icone={mdiImageMultipleOutline} message={t('assets.aucun')} />
  }

  return (
    <div ref={defilement} className="h-full overflow-auto p-2">
      {affichage === 'grille' ? (
        <GrilleAssets assets={assets} />
      ) : (
        <ListeAssets assets={assets} conteneur={defilement} />
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
  conteneur: RefObject<HTMLDivElement | null>
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
