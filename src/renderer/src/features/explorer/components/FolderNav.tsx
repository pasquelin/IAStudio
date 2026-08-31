import { mdiArrowUp, mdiChevronLeft, mdiChevronRight } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/components/ToolButton'
import { TIP_BOTTOM } from '@/helpers/tooltip'

export type FolderNavProps = {
  canBack: boolean
  canForward: boolean
  canUp: boolean
  onBack: () => void
  onForward: () => void
  onUp: () => void
}

/**
 * Back, forward and up, for the grid. The crumbs at the foot already name the way up, and they
 * were not enough: a walk is read at the TOP of a panel, where one looks before scrolling.
 *
 * A group and not a row: it rides on the search field's line, a side dock being too short to
 * spend one of its rows on three buttons.
 */
export function FolderNav({ canBack, canForward, canUp, onBack, onForward, onUp }: FolderNavProps) {
  const { t } = useTranslation()

  return (
    <div className="flex shrink-0 items-center gap-2">
      <ToolButton
        icon={mdiChevronLeft}
        label={t('explorer.back')}
        description={t('explorer.backHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={!canBack}
        onClick={onBack}
      />
      <ToolButton
        icon={mdiChevronRight}
        label={t('explorer.forward')}
        description={t('explorer.forwardHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={!canForward}
        onClick={onForward}
      />
      <ToolButton
        icon={mdiArrowUp}
        label={t('explorer.up')}
        description={t('explorer.upHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={!canUp}
        onClick={onUp}
      />
    </div>
  )
}
