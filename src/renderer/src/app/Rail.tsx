import { useTranslation } from 'react-i18next'
import { cn } from '@/design/cn'
import { infobulleSimple } from '@/design/infobulle'
import { ToolButton } from '@/design/ToolButton'
import { cleTitreOutil, outilsDeZone, type IdOutil, type ZoneOutils } from './outils'

export type RailProps = {
  /** Bord où le rail est collé. Le rail gauche porte aussi les outils de la bande basse. */
  cote: 'gauche' | 'droite'
  ouverts: Partial<Record<ZoneOutils, IdOutil | null>>
  zoneFocus: ZoneOutils | null
  surBascule: (zone: ZoneOutils, outil: IdOutil) => void
}

/**
 * Rail d'icônes d'un bord, à la manière d'un IDE : il reste posé quand la zone est refermée,
 * et c'est le seul moyen de rouvrir un outil qu'on vient de fermer.
 *
 * Le rail gauche est scindé en deux groupes — les outils de la colonne gauche en haut, ceux
 * de la bande basse en bas — pour que la position de l'icône dise où l'outil va s'ouvrir.
 */
export function Rail({ cote, ouverts, zoneFocus, surBascule }: RailProps) {
  const hautes: ZoneOutils[] = cote === 'gauche' ? ['gauche', 'haut'] : ['droite']
  const basses: ZoneOutils[] = cote === 'gauche' ? ['bas'] : []

  return (
    <div
      role="toolbar"
      aria-orientation="vertical"
      className="flex w-(--sc-rail) shrink-0 flex-col items-center justify-between py-(--sc-gouttiere)"
    >
      <GroupeRail zones={hautes} ouverts={ouverts} zoneFocus={zoneFocus} surBascule={surBascule} />
      <GroupeRail zones={basses} ouverts={ouverts} zoneFocus={zoneFocus} surBascule={surBascule} />
    </div>
  )
}

function GroupeRail({
  zones,
  ouverts,
  zoneFocus,
  surBascule,
}: {
  zones: ZoneOutils[]
  ouverts: Partial<Record<ZoneOutils, IdOutil | null>>
  zoneFocus: ZoneOutils | null
  surBascule: (zone: ZoneOutils, outil: IdOutil) => void
}) {
  const { t } = useTranslation()
  const infobulle = infobulleSimple('right')

  return (
    <div className="flex flex-col items-center gap-1">
      {zones.flatMap(zone =>
        outilsDeZone(zone).map(outil => {
          const ouvert = ouverts[zone] === outil.id
          return (
            <ToolButton
              key={outil.id}
              icone={outil.icone}
              tailleIcone={22}
              libelle={t(cleTitreOutil(outil.id))}
              infobulle={infobulle}
              actif={ouvert}
              accentue={ouvert && zoneFocus === zone}
              onClick={() => surBascule(zone, outil.id)}
              className={cn('size-(--sc-bouton-rail) rounded-(--radius-sc-md)')}
            />
          )
        }),
      )}
    </div>
  )
}
