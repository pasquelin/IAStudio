import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react'
import { useCallback, useRef } from 'react'
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
 * d'état en pied. Les onglets appartiennent au centre — un document a un nom, un outil a
 * une icône.
 */
export function Shell() {
  const espaceActif = useDispositions(etat => etat.espaceActif)
  const activerEspace = useDispositions(etat => etat.activerEspace)
  const ouverts = useOutils(etat => etat.ouverts)
  const basculer = useOutils(etat => etat.basculer)
  const api = useRef<DockviewApi | null>(null)

  const surPret = useCallback((evenement: DockviewReadyEvent) => {
    api.current = evenement.api
  }, [])

  const surBascule = useCallback((zone: Zone, outil: IdOutil) => basculer(zone, outil), [basculer])

  return (
    <div className="bg-chassis flex h-full flex-col">
      <TitleBar espaceActif={espaceActif} surEspace={activerEspace} />

      <div className="flex min-h-0 flex-1">
        <Rail cote="gauche" ouverts={ouverts} surBascule={surBascule} />

        {/* Les poignées occupent exactement la gouttière : l'espace entre deux surfaces EST
            la zone de redimensionnement, plutôt qu'un vide décoratif doublé d'une poignée. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col p-(--sc-gouttiere)">
          <div className="flex min-h-0 flex-1">
            <BordVertical zone="gauche" />
            <Surface className="min-w-0 flex-1">
              <DockviewReact components={COMPOSANTS_DOCUMENTS} onReady={surPret} />
            </Surface>
            <BordVertical zone="droite" />
          </div>
          <BordHorizontal zone="bas" />
        </div>

        <Rail cote="droite" ouverts={ouverts} surBascule={surBascule} />
      </div>

      <Footer />
    </div>
  )
}

function useZone(zone: Zone) {
  const ouvert = useOutils(etat => etat.ouverts[zone] ?? null)
  const taille = useOutils(etat => etat.tailles[zone] ?? tailleParDefaut(zone))
  const fermer = useOutils(etat => etat.fermer)
  const redimensionner = useOutils(etat => etat.redimensionner)
  return { ouvert, taille, fermer, redimensionner }
}

function BordVertical({ zone }: { zone: 'gauche' | 'droite' }) {
  const { ouvert, taille, fermer, redimensionner } = useZone(zone)
  if (!ouvert) return null

  const panneau = (
    <ZoneOutils zone={zone} outil={ouvert} taille={taille} surFermer={() => fermer(zone)} />
  )
  const poignee = (
    <PoigneeRedimension
      zone={zone}
      taille={taille}
      surTaille={valeur => redimensionner(zone, valeur)}
    />
  )

  return zone === 'gauche' ? (
    <>
      {panneau}
      {poignee}
    </>
  ) : (
    <>
      {poignee}
      {panneau}
    </>
  )
}

function BordHorizontal({ zone }: { zone: 'haut' | 'bas' }) {
  const { ouvert, taille, fermer, redimensionner } = useZone(zone)
  if (!ouvert) return null

  const panneau = (
    <ZoneOutils zone={zone} outil={ouvert} taille={taille} surFermer={() => fermer(zone)} />
  )
  const poignee = (
    <PoigneeRedimension
      zone={zone}
      taille={taille}
      surTaille={valeur => redimensionner(zone, valeur)}
    />
  )

  return zone === 'haut' ? (
    <>
      {panneau}
      {poignee}
    </>
  ) : (
    <>
      {poignee}
      {panneau}
    </>
  )
}
