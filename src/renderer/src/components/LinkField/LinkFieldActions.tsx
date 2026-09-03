import { mdiClose, mdiFolderSearchOutline } from '@mdi/js'
import { TIP_LEFT } from '@/helpers/tooltip'
import { ROW_ACTION_SPACER } from '../styles'
import { ToolButton } from '../ToolButton'
import type { LinkPress } from './linkPress'

type LinkActionsProps = {
  browse?: LinkPress
  clearLabel: string
  emptyLabel?: string
  onClear: () => void
  value: string | null
}

export function LinkFieldActions({
  browse,
  clearLabel,
  emptyLabel,
  onClear,
  value,
}: LinkActionsProps) {
  return (
    <>
      {browse && (
        <ToolButton
          icon={mdiFolderSearchOutline}
          label={browse.label}
          description={browse.hint}
          tooltip={TIP_LEFT}
          variant="header"
          onClick={browse.run}
        />
      )}
      {emptyLabel === undefined ? (
        <span aria-hidden className={ROW_ACTION_SPACER} />
      ) : (
        <ToolButton
          icon={mdiClose}
          label={clearLabel}
          tooltip={TIP_LEFT}
          variant="header"
          disabled={value === null}
          onClick={onClear}
        />
      )}
    </>
  )
}
