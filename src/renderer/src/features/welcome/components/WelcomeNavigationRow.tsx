import { mdiBlenderSoftware, mdiCubeOutline, mdiUnity, mdiUnreal } from '@mdi/js'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { UiIcon } from '@/components/UiIcon'
import { WINDOW_ROW_BUTTON } from '@/components/windowStyles'
import type { DeclaredPreset } from '@shared/domain/navigationPreset'
import { WelcomeMark } from './WelcomeMark'

/**
 * The mark of each application, as far as the icon set goes. Roblox publishes no glyph here and
 * takes the cube its own logo is built on — named rather than left to look like an oversight.
 */
const GLYPH: Record<Exclude<DeclaredPreset, 'studio'>, string> = {
  unreal: mdiUnreal,
  unity: mdiUnity,
  blender: mdiBlenderSoftware,
  roblox: mdiCubeOutline,
}

/**
 * One application in the navigation list. A row and not a chip (Alban): five names wrapped onto
 * two lines of chips, the fifth sat alone under the others, and a logo has nowhere to go on a
 * control whose height is a text gauge.
 *
 * Chosen is `accent-soft`, the token for what is DESIGNATED — the studio's own is the one row
 * that carries a colour icon, because the studio's own is the one whose mark we ship.
 */
export function WelcomeNavigationRow({
  preset,
  label,
  hint,
  chosen,
  onClick,
}: {
  preset: DeclaredPreset
  label: string
  hint: string
  chosen: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onClick}
      {...HINT_RIGHT(hint)}
      className={cn(
        WINDOW_ROW_BUTTON,
        'items-center gap-3 rounded-(--radius-sc-sm) border-b-0 px-3 py-2',
        chosen && 'bg-accent-soft hover:bg-accent-soft',
      )}
    >
      {preset === 'studio' ? (
        <WelcomeMark className="size-5 shrink-0" decorative />
      ) : (
        <UiIcon path={GLYPH[preset]} size={20} className="shrink-0" />
      )}
      <span className="text-sm">{label}</span>
    </button>
  )
}
