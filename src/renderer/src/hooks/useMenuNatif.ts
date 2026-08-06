import { useEffect } from 'react'
import { estIdOutil, estZoneOutils } from '@/app/outils'
import { useOutils } from '@/stores/outils'

/**
 * Relie le menu natif au shell. C'est par là qu'un module retiré par sa croix revient :
 * sans cette écoute, « Affichage ▸ Modules » ne ferait rien et le panneau serait perdu.
 */
export function useMenuNatif(): void {
  useEffect(() => {
    if (typeof studio === 'undefined') return

    const arreterOutil = studio.menu.surOuvrirOutil(({ zone, outil }) => {
      if (!estZoneOutils(zone) || !estIdOutil(outil)) return
      const etat = useOutils.getState()
      if (etat.ouverts[zone] !== outil) etat.basculer(zone, outil)
      etat.focaliser(zone)
    })

    const arreterCommande = studio.menu.surCommande(commande => {
      if (commande === 'disposition:reinitialiser') useOutils.getState().reinitialiser()
    })

    return () => {
      arreterOutil()
      arreterCommande()
    }
  }, [])
}
