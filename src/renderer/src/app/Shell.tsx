import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react'
import { useCallback, useRef } from 'react'
import { InfobulleGlobale } from '@/design/InfobulleGlobale'
import { useDispositions } from '@/stores/dispositions'
import { tailleParDefaut, useOutils } from '@/stores/outils'
import { COMPOSANTS_DOCUMENTS } from './documents'
import { Footer } from './Footer'
import type { IdOutil, ZoneOutils as Zone } from './outils'
import { PoigneeRedimension } from './PoigneeRedimension'
import { Rail } from './Rail'
import { TitleBar } from './TitleBar'
import { Surface, ZoneOutils } from './ZoneOutils'
import 'dockview-react/dist/styles/dockview.css'
import './dockview-theme.css'

/**
 * Assemble le studio : rails d'icônes collés aux bords, fenêtres d'outils arrondies posées
 * sur la gouttière du châssis, Dockview au centre pour les seuls documents, et une ligne
 * d'état en pied.
 *
 * Le centre ne reçoit QUE des documents : un fichier ouvert et sa barre d'outils. Les
 * fenêtres d'outils vivent sur les bords, et n'y entrent jamais.
 */
export function Shell() {
  const espaceActif = useDispositions(etat => etat.espaceActif)
  const activerEspace = useDispositions(etat => etat.activerEspace)
  const ouverts = useOutils(etat => etat.ouverts)
  const zoneFocus = useOutils(etat => etat.zoneFocus)
  const basculer = useOutils(etat => etat.basculer)
  const focaliser = useOutils(etat => etat.focaliser)
  const api = useRef<DockviewApi | null>(null)

  const surPret = useCallback((evenement: DockviewReadyEvent) => {
    api.current = evenement.api
  }, [])

  const surBascule = useCallback((zone: Zone, outil: IdOutil) => basculer(zone, outil), [basculer])

  return (
    <div className="bg-chassis flex h-full flex-col">
      <TitleBar espaceActif={espaceActif} surEspace={activerEspace} />

      <div className="flex min-h-0 flex-1">
        <Rail cote="gauche" ouverts={ouverts} zoneFocus={zoneFocus} surBascule={surBascule} />

        {/* Les poignées occupent exactement la gouttière : l'espace entre deux surfaces EST
            la zone de redimensionnement, plutôt qu'un vide décoratif doublé d'une poignée. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col py-(--sc-gouttiere)">
          <div className="flex min-h-0 flex-1">
            <BordVertical zone="gauche" />
            <Surface className="min-w-0 flex-1" onPointerDownCapture={() => focaliser(null)}>
              <DockviewReact components={COMPOSANTS_DOCUMENTS} onReady={surPret} />
            </Surface>
            <BordVertical zone="droite" />
          </div>
          <BordHorizontal zone="bas" />
        </div>

        <Rail cote="droite" ouverts={ouverts} zoneFocus={zoneFocus} surBascule={surBascule} />
      </div>

      <Footer />
      <InfobulleGlobale />
    </div>
  )
}

function useZone(zone: Zone) {
  const ouvert = useOutils(etat => etat.ouverts[zone] ?? null)
  const taille = useOutils(etat => etat.tailles[zone] ?? tailleParDefaut(zone))
  const reduite = useOutils(etat => etat.reduites[zone] ?? false)
  const fermer = useOutils(etat => etat.fermer)
  const reduire = useOutils(etat => etat.reduire)
  const focaliser = useOutils(etat => etat.focaliser)
  const redimensionner = useOutils(etat => etat.redimensionner)
  return { ouvert, taille, reduite, fermer, reduire, focaliser, redimensionner }
}

function useMorceaux(zone: Zone) {
  const etat = useZone(zone)
  if (!etat.ouvert) return null

  return {
    panneau: (
      <ZoneOutils
        zone={zone}
        outil={etat.ouvert}
        taille={etat.taille}
        reduite={etat.reduite}
        surFocus={() => etat.focaliser(zone)}
        surReduire={() => etat.reduire(zone)}
        surFermer={() => etat.fermer(zone)}
      />
    ),
    poignee: etat.reduite ? null : (
      <PoigneeRedimension
        zone={zone}
        taille={etat.taille}
        surTaille={(valeur, disponible) => etat.redimensionner(zone, valeur, disponible)}
      />
    ),
  }
}

function BordVertical({ zone }: { zone: 'gauche' | 'droite' }) {
  const morceaux = useMorceaux(zone)
  if (!morceaux) return null

  return zone === 'gauche' ? (
    <>
      {morceaux.panneau}
      {morceaux.poignee}
    </>
  ) : (
    <>
      {morceaux.poignee}
      {morceaux.panneau}
    </>
  )
}

function BordHorizontal({ zone }: { zone: 'haut' | 'bas' }) {
  const morceaux = useMorceaux(zone)
  if (!morceaux) return null

  return zone === 'haut' ? (
    <>
      {morceaux.panneau}
      {morceaux.poignee}
    </>
  ) : (
    <>
      {morceaux.poignee}
      {morceaux.panneau}
    </>
  )
}
