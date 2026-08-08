import {
  mdiAlertCircleOutline,
  mdiCloudOffOutline,
  mdiCloudOutline,
  mdiCloudSyncOutline,
  mdiCloudUploadOutline,
  mdiHarddisk,
  mdiSourceBranch,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { AssetBadge as Badge } from '@shared/domain/asset'
import { cn } from '@/helpers/cn'
import { UiIcon } from './UiIcon'

/**
 * What each state looks like. A glyph rather than a colour alone: the six states have to be
 * told apart on a 112 px tile, and three of them are ordinary rather than alarming — colour on
 * its own would either shout at all of them or say nothing.
 */
const GLYPHS: Record<Badge, string> = {
  'local-only': mdiHarddisk,
  synced: mdiCloudSyncOutline,
  'to-push': mdiCloudUploadOutline,
  'to-pull': mdiCloudOutline,
  conflict: mdiSourceBranch,
  error: mdiAlertCircleOutline,
  // Its twin is in a project this key does not open onto: nothing to do, but not settled either.
  'other-account': mdiCloudOffOutline,
}

/**
 * Only what needs attention is coloured. A settled asset and a purely local one are the normal
 * cases — painting them would make a shelf of ordinary assets look like a list of problems.
 */
const TONES: Record<Badge, string> = {
  'local-only': 'text-muted',
  synced: 'text-muted',
  'to-push': 'text-accent',
  'to-pull': 'text-accent',
  conflict: 'text-danger',
  error: 'text-danger',
  'other-account': 'text-muted',
}

/**
 * The corner mark that says where an asset lives.
 *
 * Not drawn at all for the two settled states in a dense grid — see `showQuiet`. A mark on every
 * one of two hundred tiles is noise, and the states worth a glance are the ones that need doing
 * something about. The list view, which has room, shows all of them.
 */
export function AssetBadge({ badge, showQuiet = false }: { badge: Badge; showQuiet?: boolean }) {
  const { t } = useTranslation()
  const quiet = badge === 'local-only' || badge === 'synced'

  if (quiet && !showQuiet) return null

  const label = t(`assets.badge.${badge}`)

  return (
    <span
      className={cn('pointer-events-none inline-flex items-center', TONES[badge])}
      // The glyph carries the meaning, so it needs the words a colour cannot give.
      title={label}
      aria-label={label}
      role="img"
    >
      <UiIcon path={GLYPHS[badge]} size={12} />
    </span>
  )
}
