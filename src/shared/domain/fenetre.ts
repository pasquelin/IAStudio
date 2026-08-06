/** Ce dont les pastilles dessinées ont besoin pour se rendre comme les boutons système. */
export type EtatFenetre = {
  /** Fenêtre au premier plan : les pastilles sont colorées, sinon grises. */
  active: boolean
  pleinEcran: boolean
  maximisee: boolean
}

export const ETAT_FENETRE_INITIAL: EtatFenetre = {
  active: true,
  pleinEcran: false,
  maximisee: false,
}
