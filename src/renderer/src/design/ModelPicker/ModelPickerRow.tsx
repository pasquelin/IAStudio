import { useTranslation } from 'react-i18next'
import { LOCAL_RUNTIME, type ModelSummary } from '@shared/domain/model'
import { cn } from '@/helpers/cn'
import { ROW_SUBJECT, rowSkin } from '../styles'

export type ModelPickerRowProps = {
  model: ModelSummary
  selected: boolean
  /** Why it cannot be picked right now, in the host's own words. Absent when it can. */
  refusal?: string
  onPick: () => void
}

/**
 * One model in the picker: what it is called, where it runs, and what stands between it and a
 * generation. Deliberately three lines at most — § 16 asks for what is useful, not for a card.
 */
export function ModelPickerRow({ model, selected, refusal, onPick }: ModelPickerRowProps) {
  const { t } = useTranslation()
  const local = model.runsOn === LOCAL_RUNTIME

  return (
    <button
      type="button"
      role="menuitem"
      data-selected={selected || undefined}
      className={cn(rowSkin(selected), 'flex w-full flex-col items-start gap-0.5 px-2 py-1.5')}
      onClick={onPick}
    >
      <span className={ROW_SUBJECT}>{model.name}</span>
      <span className="text-muted text-tiny">
        {[
          local ? t('models.runsLocally') : t(`aiClouds.${model.runsOn}`),
          // What stands in the way, said on the row rather than discovered after a click.
          refusal,
        ]
          .filter(part => part !== undefined)
          .join(' · ')}
      </span>
    </button>
  )
}
