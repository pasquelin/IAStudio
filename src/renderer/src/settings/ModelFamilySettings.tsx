import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelFamily, ModelSummary } from '@shared/domain/model'
import { isBeyondPlan } from '@shared/domain/plan'
import { ModelOptions } from '@/design/ModelOptions'
import { getBridge } from '@/services/bridge'
import { usePlanAccess } from '@/helpers/plan-access'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settings-draft'

/**
 * A `<select>` is not a browser: past a hundred entries it stops being usable long before it
 * stops being complete. This picker deliberately shows only the head of the catalogue — the
 * order is the API's own relevance score, so the most used models are the ones it holds.
 */
const PICKER_LIMIT = 100

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
      .searchModels({ family, limit: PICKER_LIMIT })
      .then(page => {
        if (current) setModels(page.items)
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

/**
 * The stored default kept among the options whatever the page holds, so the screen never shows
 * an empty picker over a setting that IS set — a `<select>` whose value matches no option has
 * `selectedIndex === -1` and renders blank, and the next stray change overwrites it unseen.
 * `ModelNodeFields` does the same for the model a graph node runs.
 */
function withStored(models: readonly ModelSummary[], stored: string): readonly ModelSummary[] {
  if (!stored || models.some(model => model.id === stored)) return models
  return [{ ...PLACEHOLDER, id: stored, name: stored }, ...models]
}

/** Enough of a summary to name a row; the picker reads nothing else off it. */
const PLACEHOLDER: Omit<ModelSummary, 'id' | 'name'> = {
  family: 'other',
  source: 'other',
  origin: 'community',
  featured: false,
  capabilities: [],
  tags: [],
}

/** Per-family generation settings. Today: which model the generator preselects. */
export function ModelFamilySettings({ family }: { family: ModelFamily }) {
  const { t } = useTranslation()
  const fetched = useFamilyModels(family)
  const plan = usePlanAccess()
  const stored = useSettings(state => state.settings.generation.defaultModels)
  const stageBranch = useSettingsDraft(state => state.stageBranch)
  // Staged like every other setting: this screen writes a branch no path can name, which is
  // exactly what `stageBranch` exists for — it must not slip past Apply on its own.
  const staged = useSettingsDraft(state => state.pending.generation?.defaultModels)

  const defaultModels = staged ?? stored
  const selected = defaultModels[family] ?? ''
  const models = withStored(fetched, selected)

  /**
   * The default that is ALREADY stored, which nobody is choosing right now. A downgrade or an
   * account switch can put it out of plan, and a browser still shows a disabled `<option>` as
   * the selected one — silently, since the suffix only lives in the option labels. The
   * generator would then open armed on it and fail on every submission.
   */
  const selectedModel = models.find(model => model.id === selected)
  const selectedRefused =
    plan !== null && isBeyondPlan(selectedModel?.requiredPlanLevel, plan) ? plan : null

  return (
    <div className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-2 text-xs">
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
            stageBranch({ generation: { defaultModels: next } })
          }}
        >
          <option value="">{t('settings.noDefaultModel')}</option>
          <ModelOptions models={models} plan={plan} />
        </select>
      </label>

      {selectedRefused && (
        <p className="text-warning text-xs">
          {t('models.planLockedHint', { plan: selectedRefused.name })}
        </p>
      )}
    </div>
  )
}
