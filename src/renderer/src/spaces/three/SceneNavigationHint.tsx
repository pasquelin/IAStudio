import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_MOTION, type MotionId } from '@shared/domain/shortcut'
import { VIEWPORT_READOUT } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { formatDecimal } from '@/helpers/format'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'

export type SceneNavigationHintProps = {
  /** Metres per second the wheel left the flight at, or `null` while it has said nothing. */
  speed: number | null
}

/** How long the keys stay up. Long enough to read once, short enough not to become furniture. */
const LINGER_MS = 6000

/** The directions worth naming, grouped as a hand finds them. Exported: the labels are composed
 * from it, so `dynamic-keys.i18n.test.ts` walks this very table. */
export const NAVIGATION_HINT_GROUPS: readonly {
  readonly key: string
  readonly motions: readonly MotionId[]
}[] = [
  { key: 'move', motions: ['forward', 'left', 'back', 'right'] },
  { key: 'altitude', motions: ['up', 'down'] },
  { key: 'boost', motions: ['boost'] },
]

/**
 * The keys a flight answers to. Mounted only while the mode is armed, so every arming opens on
 * them again — a legend that never leaves stops being read and becomes scenery.
 */
export function SceneNavigationHint({ speed }: SceneNavigationHintProps) {
  const { t, i18n } = useTranslation()
  const label = useShortcutLabel()
  // Open, and only ever closed by the timer: this component lives exactly as long as one arming.
  const [shown, setShown] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShown(false), LINGER_MS)
    return () => clearTimeout(timer)
  }, [])

  // The speed outlives the keys — it moves under the hand — but an empty panel must not.
  if (!shown && speed === null) return null

  return (
    <div
      className={cn(VIEWPORT_READOUT, 'bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-3')}
    >
      {shown && (
        <>
          {NAVIGATION_HINT_GROUPS.map(group => (
            <span key={group.key} className="flex items-center gap-2">
              {group.motions.map(motion => (
                <kbd key={motion} className="text-text">
                  {label(DEFAULT_MOTION[motion][0] ?? null)}
                </kbd>
              ))}
              <span>{t(`sceneNavigation.${group.key}`)}</span>
            </span>
          ))}
          <span>{t('sceneNavigation.leave')}</span>
        </>
      )}
      {speed !== null && (
        <span className="text-text tabular-nums">
          {t('sceneNavigation.speed', {
            value: formatDecimal(speed, i18n.language, { digits: 1 }),
          })}
        </span>
      )}
    </div>
  )
}
