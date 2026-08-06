import { useTranslation } from 'react-i18next'
import { useSettings } from '@/stores/settings'

const NUMBER_INPUT = 'input input-sm w-24'

export function GenerationSettings() {
  const { t } = useTranslation()
  const generation = useSettings(state => state.settings.generation)
  const write = useSettings(state => state.write)

  return (
    <div className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs">
        {t('settings.concurrentJobs')}
        <input
          className={NUMBER_INPUT}
          type="number"
          min={1}
          max={16}
          value={generation.concurrentJobs}
          onChange={event => {
            const concurrentJobs = event.target.valueAsNumber
            if (Number.isInteger(concurrentJobs)) void write({ generation: { concurrentJobs } })
          }}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        {t('settings.maxRetries')}
        <input
          className={NUMBER_INPUT}
          type="number"
          min={0}
          max={10}
          value={generation.maxRetries}
          onChange={event => {
            const maxRetries = event.target.valueAsNumber
            if (Number.isInteger(maxRetries)) void write({ generation: { maxRetries } })
          }}
        />
      </label>
    </div>
  )
}
