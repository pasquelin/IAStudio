import {
  DockviewReact,
  type AddPanelPositionOptions,
  type Direction,
  type DockviewApi,
  type DockviewReadyEvent,
} from 'dockview-react'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispositions } from '@/stores/dispositions'
import { espaceParId, type IdEspace, type PlacementPanneau, type ZonePanneau } from './espaces'
import { cleTitrePanneau, COMPOSANTS_PANNEAUX } from './panneaux'
import { TitleBar } from './TitleBar'
import 'dockview-react/dist/styles/dockview.css'
import './dockview-theme.css'

const DIRECTIONS: Record<Exclude<ZonePanneau, 'onglet' | 'centre'>, Direction> = {
  gauche: 'left',
  droite: 'right',
  haut: 'above',
  bas: 'below',
}

function positionDe(
  placement: PlacementPanneau,
  precedent: string | undefined,
  premier: boolean,
): AddPanelPositionOptions | undefined {
  if (premier) return undefined
  // `onglet` rejoint le panneau précédent au lieu d'ouvrir un groupe ; les autres zones
  // se posent sur la racine, ce qui leur donne toute la largeur ou toute la hauteur.
  if (placement.zone === 'onglet') {
    return precedent ? { referencePanel: precedent, direction: 'within' } : undefined
  }
  if (placement.zone === 'centre') return undefined
  return { direction: DIRECTIONS[placement.zone] }
}

function poserDispositionParDefaut(
  api: DockviewApi,
  espace: IdEspace,
  titre: (cle: string) => string,
): void {
  const { panneaux } = espaceParId(espace)
  api.clear()
  let precedent: string | undefined
  panneaux.forEach((placement, index) => {
    api.addPanel({
      id: placement.id,
      component: placement.id,
      title: titre(cleTitrePanneau(placement.id)),
      position: positionDe(placement, precedent, index === 0),
    })
    precedent = placement.id
  })
}

export function Shell() {
  const api = useRef<DockviewApi | null>(null)
  const espaceCharge = useRef<IdEspace | null>(null)
  const espaceActif = useDispositions(etat => etat.espaceActif)
  const activerEspace = useDispositions(etat => etat.activerEspace)
  const { t } = useTranslation()

  const appliquerEspace = useCallback(
    (espace: IdEspace) => {
      const dockview = api.current
      if (!dockview) return

      const precedent = espaceCharge.current
      if (precedent && precedent !== espace) {
        useDispositions.getState().memoriser(precedent, dockview.toJSON())
      }

      const memorisee = useDispositions.getState().dispositions[espace]
      // Une disposition mémorisée peut référencer un panneau qui n'existe plus après une mise
      // à jour : on retombe alors sur la disposition par défaut plutôt que sur un dock vide.
      if (memorisee) {
        try {
          dockview.fromJSON(memorisee)
        } catch {
          poserDispositionParDefaut(dockview, espace, t)
        }
      } else {
        poserDispositionParDefaut(dockview, espace, t)
      }
      espaceCharge.current = espace
    },
    [t],
  )

  const surPret = useCallback(
    (evenement: DockviewReadyEvent) => {
      api.current = evenement.api
      appliquerEspace(espaceActif)
    },
    [appliquerEspace, espaceActif],
  )

  useEffect(() => {
    if (api.current) appliquerEspace(espaceActif)
  }, [espaceActif, appliquerEspace])

  return (
    <div className="flex h-full flex-col">
      <TitleBar espaceActif={espaceActif} surEspace={activerEspace} />
      <div className="min-h-0 flex-1">
        <DockviewReact components={COMPOSANTS_PANNEAUX} onReady={surPret} />
      </div>
    </div>
  )
}
