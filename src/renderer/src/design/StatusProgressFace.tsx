import { mdiChevronUp } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { formatPercent } from '@/helpers/format'
import { ProgressBar } from './ProgressBar'
import { UiIcon } from './UiIcon'

export type StatusProgressFaceProps = {
  /** The sentence the button shows, and what names the bar. Already translated. */
  label: string
  /** How far along, 0 to 1. Absent where the sentence stands alone — a count of failures. */
  ratio?: number
}

/** The face of a status button reporting work under way — the generations, and the tasks. */
export function StatusProgressFace({ label, ratio }: StatusProgressFaceProps) {
  const { i18n } = useTranslation()

  return (
    <>
      <span>{label}</span>
      {ratio !== undefined && (
        <>
          <ProgressBar ratio={ratio} label={label} className="w-12" />
          <span>{formatPercent(ratio, i18n.language)}</span>
        </>
      )}
      <UiIcon path={mdiChevronUp} size={12} />
    </>
  )
}
