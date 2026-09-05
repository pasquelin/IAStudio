import { useTranslation } from 'react-i18next'
import markUrl from '../../../../../../build/icon.svg?url'

/**
 * The Dock icon, TILE included — the splash strips it, painting that colour itself. Here the ground
 * is the viewport grey, and the dark tile is what makes the mark stand in the room.
 *
 * Apple's grid leaves roughly a tenth of each side transparent: the box is a fifth larger than the
 * tile a reader sees.
 */
export function WelcomeMark({
  className = 'size-36',
  decorative = false,
}: {
  className?: string
  /** Set where the row beside it already spells the name — a mark read twice is the name twice. */
  decorative?: boolean
}) {
  const { t } = useTranslation()
  return <img src={markUrl} alt={decorative ? '' : t('app.name')} className={className} />
}
