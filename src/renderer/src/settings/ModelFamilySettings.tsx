import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelFamily, ModelSummary } from '@shared/domain/model'
import { getBridge } from '@/services/bridge'
import { useSettings } from '@/stores/settings'

/**
 * The models of one family, fetched here rather than through a store: this list is read by
 * one screen, it is already cached by the registry in the main process, and the settings
 * window has no reason to hold a second replica of the catalogue.
 */
function useFamilyModels(family: ModelFamily): ModelSummary[] {
  const [models, setModels] = useState<ModelSummary[]>([])

  useEffect(() => {
    let current = true
    const bridge = getBridge()

    void bridge?.scenario
      .listModels(family)
      .then(found => {
        if (current) setModels(found)
      })
      .catch(() => {
        // Not authenticated, or offline: an empty picker says so on its own.
        if (current) setModels([])
      })

    return () => {
      current = false
    }
  }, [family])

  return models
}

/** Per-family generation settings. Today: which model the generator preselects. */
export function ModelFamilySettings({ family }: { family: ModelFamily }) {
  const { t } = useTranslation()
  const models = useFamilyModels(family)
  const defaultModels = useSettings(state => state.settings.generation.defaultModels)
  const write = useSettings(state => state.write)

  const selected = defaultModels[family] ?? ''

  return (
    <div className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs">
        {t('settings.defaultModel')}
        <select
          className="select select-sm"
          value={selected}
          onChange={event => {
            // "Ask every time" is the absence of a key, not an empty model id — which the
            // main process would reject.
            const next = { ...defaultModels }
            if (event.target.value) next[family] = event.target.value
            else delete next[family]
            void write({ generation: { defaultModels: next } })
          }}
        >
          <option value="">{t('settings.noDefaultModel')}</option>
          {models.map(model => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
