import type { ActivityEntry } from '@shared/domain/activity'
import { UiIcon } from '@/components/UiIcon'
import { TONE_TEXT } from '@/components/styles'
import { cn } from '@/helpers/cn'
import { GLYPHS, TONES } from './activityLevels'
import { ActivityListMessage } from './ActivityListMessage'
import { ActivityListSaid } from './ActivityListSaid'

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
export function ActivityListRow({
  entry,
  time,
  clamp,
}: {
  entry: ActivityEntry
  time: string
  /** Cuts the detail short — the flyout does, its own window does not. */
  clamp: boolean
}) {
  return (
    <div role="listitem" className="flex items-start gap-2 px-2 py-1.5">
      <UiIcon
        path={GLYPHS[entry.level]}
        size={14}
        className={cn('mt-px shrink-0', TONE_TEXT[TONES[entry.level]])}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <ActivityListMessage entry={entry} clamp={clamp} />
        {/* Only where there is room: the flyout cuts a detail to three lines, and a toast has
            neither a virtualiser nor a height to hold to. */}
        {!clamp && typeof entry.params?.['said'] === 'string' && (
          <ActivityListSaid said={entry.params['said']} />
        )}
      </div>
      <span className="text-muted text-tiny shrink-0 tabular-nums">{time}</span>
    </div>
  )
}
