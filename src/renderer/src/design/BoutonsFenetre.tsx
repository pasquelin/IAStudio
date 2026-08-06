import { useTranslation } from 'react-i18next'
import { cn } from './cn'
import { useEtatFenetre } from '@/hooks/useEtatFenetre'

type Pastille = {
  id: 'fermer' | 'reduire' | 'zoomer'
  couleur: string
  cleLibelle: string
}

/** Couleurs des feux macOS, relevées sur le système. */
const PASTILLES: readonly Pastille[] = [
  { id: 'fermer', couleur: '#ff5f57', cleLibelle: 'fenetre.fermer' },
  { id: 'reduire', couleur: '#febc2e', cleLibelle: 'fenetre.reduire' },
  { id: 'zoomer', couleur: '#28c840', cleLibelle: 'fenetre.zoomer' },
]

const GRIS_INACTIF = '#4e5157'

/**
 * Feux de circulation dessinés. Les natifs ont été retirés (`setWindowButtonVisibility`)
 * parce que macOS les emporte en plein écran et qu'aucune API Electron ne permet de les y
 * garder : seul AppKit le peut, via `NSTitlebarAccessoryViewController`.
 *
 * Ceux-ci vivent dans le DOM, donc ils restent en plein écran comme en fenêtré, et ils
 * reprennent les conventions du système : glyphes au survol du GROUPE (pas du bouton),
 * teinte perdue quand la fenêtre n'est plus au premier plan, « réduire » désactivé en plein
 * écran. Sur Windows le groupe passera à droite sans rien réécrire.
 */
export function BoutonsFenetre() {
  const { t } = useTranslation()
  const { active, pleinEcran } = useEtatFenetre()

  const agir = (id: Pastille['id']): void => {
    if (typeof studio === 'undefined') return
    if (id === 'fermer') void studio.fenetre.fermer()
    else if (id === 'reduire') void studio.fenetre.reduire()
    else void studio.fenetre.basculerPleinEcran()
  }

  return (
    <div className="group/feux flex items-center gap-2 pr-2">
      {PASTILLES.map(pastille => {
        const desactive = pastille.id === 'reduire' && pleinEcran
        return (
          <button
            key={pastille.id}
            type="button"
            aria-label={t(pastille.cleLibelle)}
            disabled={desactive}
            onClick={() => agir(pastille.id)}
            style={{ backgroundColor: active && !desactive ? pastille.couleur : GRIS_INACTIF }}
            className={cn(
              'relative size-3 shrink-0 rounded-full border-none p-0',
              desactive ? 'cursor-default' : 'cursor-pointer',
            )}
          >
            {!desactive && <Glyphe id={pastille.id} pleinEcran={pleinEcran} />}
          </button>
        )
      })}
    </div>
  )
}

function Glyphe({ id, pleinEcran }: { id: Pastille['id']; pleinEcran: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className="absolute inset-0 size-full opacity-0 transition-opacity group-hover/feux:opacity-100"
      fill="none"
      stroke="#00000090"
      strokeWidth="1.3"
      strokeLinecap="round"
    >
      {id === 'fermer' && <path d="M4 4l4 4M8 4l-4 4" />}
      {id === 'reduire' && <path d="M3.5 6h5" />}
      {id === 'zoomer' &&
        (pleinEcran ? (
          <path d="M7.5 4.5h-3v3M4.5 7.5l3-3" />
        ) : (
          <path d="M4.2 7.8V4.2h3.6M7.8 4.2L4.2 7.8" />
        ))}
    </svg>
  )
}
