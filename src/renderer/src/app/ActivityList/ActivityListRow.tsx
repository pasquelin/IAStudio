import type { ActivityEntry } from '@shared/domain/activity'
import { UiIcon } from '@/design/UiIcon'
import { TONE_TEXT } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { GLYPHS, TONES } from './activityLevels'
import { ActivityListMessage } from './ActivityListMessage'

/**
 * One journal line. Written twice once — the panel had `tabular-nums` but no `shrink-0`, so a
 * long message squeezed its level glyph; the home band had `shrink-0` but no `tabular-nums`, so
 * its timestamps did not line up down the column. The band is gone; the row it forced is right.
 *
 * It carries its own padding, like `ProgressRow`, which indents by `px-2` where this one indented
 * by `px-1`. Two bands stacked on the same shelf and starting at different columns is drift, not
 * a density anyone chose.
 *
 * `time` is handed over already written: an hour and an "how long ago" are the same row said to
 * two different readers.
 */
export function ActivityListRow({ entry, time }: { entry: ActivityEntry; time: string }) {
  return (
    <li className="flex items-start gap-2 px-2 py-1.5">
      <UiIcon
        path={GLYPHS[entry.level]}
        size={14}
        className={cn('mt-px shrink-0', TONE_TEXT[TONES[entry.level]])}
      />
      <ActivityListMessage entry={entry} />
      <span className="text-muted text-tiny shrink-0 tabular-nums">{time}</span>
    </li>
  )
}
