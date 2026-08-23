import { useTranslation } from 'react-i18next'
import type { ModelRefusalWord } from '@/hooks/useModelReach'
import type { ModelSummary } from '@shared/domain/model'
import { runtimeLabel } from '@/helpers/runtimeLabel'
import { cn } from '@/helpers/cn'
import { Row } from '../Row'
import { rowSkin } from '../styles'

export type ModelPickerRowProps = {
  model: ModelSummary
  selected: boolean
  /** Why it cannot be picked right now, with the sentence that explains the word. */
  refusal?: ModelRefusalWord
  onPick: () => void
}

/** One model in the picker: what it is called, where it runs, and what stands in its way. */
export function ModelPickerRow({ model, selected, refusal, onPick }: ModelPickerRowProps) {
  const { t } = useTranslation()
  const where = runtimeLabel(model.runsOn, t)

  return (
    <button
      type="button"
      role="menuitem"
      data-selected={selected || undefined}
      className={cn(rowSkin(selected), 'w-full')}
      onClick={onPick}
    >
      <Row
        title={model.name}
        subtitle={refusal ? `${where} · ${refusal.word}` : where}
        hint={refusal?.hint}
      />
    </button>
  )
}
