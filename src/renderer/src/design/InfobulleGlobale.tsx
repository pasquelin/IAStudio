import { Tooltip } from 'react-tooltip'
import { ID_INFOBULLE } from './infobulle'

/**
 * Infobulle partagée, montée une seule fois à la racine. Un `<Tooltip>` par bouton
 * multiplierait les portails et les écouteurs pour un résultat identique.
 */
export function InfobulleGlobale() {
  return (
    <Tooltip
      id={ID_INFOBULLE}
      delayShow={450}
      offset={8}
      noArrow
      className="!bg-elevated !text-texte !rounded-(--radius-sc-sm) !px-2 !py-1 !text-[11px] !shadow-(--sc-ombre-flottante)"
    />
  )
}
