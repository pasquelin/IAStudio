import { Tooltip } from 'react-tooltip'
import { TOOLTIP_ID } from './tooltip'

/**
 * Infobulle partagée, montée une seule fois à la racine. Un `<Tooltip>` par bouton
 * multiplierait les portails et les écouteurs pour un résultat identique.
 */
export function TooltipHost() {
  return (
    <Tooltip
      id={TOOLTIP_ID}
      delayShow={450}
      offset={8}
      noArrow
      className="!bg-elevated !text-text !rounded-(--radius-sc-sm) !px-2 !py-1 !text-[11px] !shadow-(--sc-shadow-floating)"
    />
  )
}
