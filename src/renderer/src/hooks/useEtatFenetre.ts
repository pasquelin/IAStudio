import { useEffect, useState } from 'react'
import { ETAT_FENETRE_INITIAL, type EtatFenetre } from '@shared/domain/fenetre'

/**
 * État de la fenêtre poussé par le main. Sans lui, les pastilles dessinées ne sauraient ni
 * qu'elles ont perdu le premier plan, ni qu'on est en plein écran.
 */
export function useEtatFenetre(): EtatFenetre {
  const [etat, setEtat] = useState<EtatFenetre>(ETAT_FENETRE_INITIAL)

  useEffect(() => {
    if (typeof studio === 'undefined') return

    void studio.fenetre.etat().then(setEtat)
    return studio.fenetre.surEtat(setEtat)
  }, [])

  return etat
}
