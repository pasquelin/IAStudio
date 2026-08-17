import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { ActivityEntry, ActivityParams } from '@shared/domain/activity'
import { isWorkspaceId } from '@shared/domain/workspace'
import { formatList } from '@/helpers/format'
import { workspaceLabelKey } from '@/helpers/workspaces'

/**
 * A line's params, with the id lists turned into words.
 *
 * The journal stores ids so a line survives a change of language, which leaves this the one
 * place that can say them out loud. Only workspace ids are listed today; an id nothing names
 * is left as it is rather than dropped — a shelf missing from a sentence reads as a bug, an
 * untranslated one reads as a shelf.
 */
function namedParams(
  params: ActivityParams | undefined,
  t: TFunction,
  language: string,
): ActivityParams | undefined {
  if (!params) return params

  const named: Record<string, string | number> = {}
  for (const [name, value] of Object.entries(params)) {
    // Narrowed by what it is not: `Array.isArray` leaves a `readonly string[]` unnarrowed.
    named[name] =
      typeof value === 'string' || typeof value === 'number'
        ? value
        : formatList(
            value.map(id => (isWorkspaceId(id) ? t(workspaceLabelKey(id)) : id)),
            language,
            'conjunction',
          )
  }
  return named
}

/**
 * What a line says, and what broke under it. Shared with the toasts: the two showed the same
 * thing written twice, which is how they would have come to show it differently.
 *
 * The detail is `persistableFailure` output — a status and a parsed body, never a stack and
 * never credentials. Small and dim: it is for whoever is asked what went wrong, not for the eye.
 */
export function ActivityListMessage({ entry }: { entry: ActivityEntry }) {
  const { t, i18n } = useTranslation()

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-text text-tiny break-words">
        {t(entry.messageKey, namedParams(entry.params, t, i18n.language))}
      </span>
      {entry.detail && (
        <span className="text-muted text-mini font-mono break-all">{entry.detail}</span>
      )}
    </div>
  )
}
