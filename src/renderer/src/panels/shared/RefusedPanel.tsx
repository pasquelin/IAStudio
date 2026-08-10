import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { toolIcon } from '@/helpers/tool-registry'
import type { ToolId } from '@shared/domain/tool'

export type RefusedPanelProps = {
  /** Whose panel this is. The glyph comes from the rail's own table, never from the caller. */
  tool: ToolId
  /** What did not answer, in the panel's own words. The generic line stands in when it has none. */
  message?: string
  onRetry: () => void
}

/**
 * What a panel draws when its read was refused: it stays, says so quietly, and offers to try.
 *
 * The panel twin of `home/RefusedSection`, which is the same policy in the shape of a band and
 * cannot be reused here — it mounts a `Section`, heading and customise menu included. Written
 * once because three panels needed it, which is exactly the count at which the bands' own copy
 * became a debt: five sites, each taking itself off the page on a refusal, indistinguishably
 * from having nothing to show.
 */
export function RefusedPanel({ tool, message, onRetry }: RefusedPanelProps) {
  const { t } = useTranslation()

  return (
    <EmptyState
      icon={toolIcon(tool)}
      message={message ?? t('home.refused')}
      action={{ label: t('home.retry'), hint: t('actions.retryHint'), onClick: onRetry }}
    />
  )
}
