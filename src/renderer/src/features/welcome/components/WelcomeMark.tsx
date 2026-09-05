import { useTranslation } from 'react-i18next'
import markUrl from '../../../../../../build/icon.svg?url'

/**
 * The Dock icon, TILE included — where the splash strips it, because that surface paints the tile
 * colour itself and a second tile would have shown as a square on a square. Here the ground is the
 * viewport grey, so the dark tile is what makes the mark read as an object standing in the room.
 *
 * The file draws on Apple's grid, so roughly a tenth of each side is transparent margin: the box
 * is a fifth larger than the tile a reader sees.
 */
export function WelcomeMark({
  className = 'size-24',
  decorative = false,
}: {
  className?: string
  /** Set where the row beside it already spells the name — a mark read twice is the name twice. */
  decorative?: boolean
}) {
  const { t } = useTranslation()
  return <img src={markUrl} alt={decorative ? '' : t('app.name')} className={className} />
}
