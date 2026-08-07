import { Tooltip } from 'react-tooltip'
import { TOOLTIP_ID } from './tooltip'

/**
 * Shared tooltip, mounted once at the root. One `<Tooltip>` per button would multiply
 * portals and listeners for an identical result.
 */
export function TooltipHost() {
  return (
    <Tooltip
      id={TOOLTIP_ID}
      delayShow={450}
      offset={8}
      noArrow
      className="bg-elevated! text-text! z-50! rounded-(--radius-sc-sm)! px-2! py-1! text-[11px]! shadow-(--sc-shadow-floating)!"
    />
  )
}
