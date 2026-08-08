import {
  mdiAlertCircleOutline,
  mdiCloudOffOutline,
  mdiCloudOutline,
  mdiCloudSyncOutline,
  mdiCloudUploadOutline,
  mdiHarddisk,
  mdiSourceBranch,
} from '@mdi/js'
import type { AssetBadge as Badge } from '@shared/domain/asset'
import { cn } from '@/helpers/cn'
import { UiIcon } from './UiIcon'

/**
 * What each state looks like.
 *
 * A glyph rather than a colour alone: seven states have to be told apart on a 112 px tile, and
 * several are ordinary rather than alarming — colour on its own would either shout at all of
 * them or say nothing. Only what needs attention is coloured, so a shelf of settled assets does
 * not read as a list of problems.
 *
 * One table rather than two parallel ones: an eighth badge is a compile error either way, but
 * "added a glyph, forgot a tone" is only possible when they are apart.
 */
const MARKS: Record<Badge, { icon: string; tone: string }> = {
  'local-only': { icon: mdiHarddisk, tone: 'text-muted' },
  synced: { icon: mdiCloudSyncOutline, tone: 'text-muted' },
  'to-push': { icon: mdiCloudUploadOutline, tone: 'text-accent' },
  'to-pull': { icon: mdiCloudOutline, tone: 'text-accent' },
  conflict: { icon: mdiSourceBranch, tone: 'text-danger' },
  error: { icon: mdiAlertCircleOutline, tone: 'text-danger' },
  // Its twin is in a project this key does not open onto: nothing to do, but not settled either.
  'other-account': { icon: mdiCloudOffOutline, tone: 'text-muted' },
}

/**
 * The corner mark that says where an asset lives.
 *
 * Not drawn at all for the two settled states in a dense grid — see `showQuiet`. A mark on every
 * one of two hundred tiles is noise, and the states worth a glance are the ones that need doing
 * something about. The list view, which has room, shows all of them.
 */
export type AssetBadgeProps = {
  badge: Badge
  label: string
  showQuiet?: boolean
  /**
   * Sits in the corner of a tile. Off in a row, which lays its marks out in the flow — the same
   * component in both places, and this badge is the one that places itself at the top right.
   */
  overlay?: boolean
}

export function AssetBadge({ badge, label, showQuiet = false, overlay = false }: AssetBadgeProps) {
  const quiet = badge === 'local-only' || badge === 'synced'
  if (quiet && !showQuiet) return null

  const mark = MARKS[badge]

  return (
    <span
      className={cn(
        'pointer-events-none inline-flex items-center',
        overlay && 'bg-chassis/75 absolute top-1 right-1 rounded-(--radius-sc-sm) p-px',
        mark.tone,
      )}
      // The glyph carries the meaning, so it needs the words a colour cannot give.
      title={label}
      aria-label={label}
      role="img"
    >
      <UiIcon path={mark.icon} size={12} />
    </span>
  )
}
