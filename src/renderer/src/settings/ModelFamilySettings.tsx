import { useTranslation } from 'react-i18next'
import type { ModelFamily } from '@shared/domain/model'
import { ModelOptions, type PickableModel } from '@/design/ModelOptions'
import { useFamilyModels } from '@/hooks/useFamilyModels'
import { usePlanAccess } from '@/hooks/usePlanAccess'
import { usePlanRefusal } from '@/hooks/usePlanRefusal'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settingsDraft'
import { SettingLine } from './SettingLine'
import { SETTING_COLUMN, SETTING_SELECT } from './settingStyles'
import { SettingRestoreButton } from './SettingRestoreButton'

/**
 * The stored default kept among the options whatever the page holds, so the screen never shows
 * an empty picker over a setting that IS set — a `<select>` whose value matches no option has
 * `selectedIndex === -1` and renders blank, and the next stray change overwrites it unseen.
 */
function withStored(models: readonly PickableModel[], stored: string): readonly PickableModel[] {
  if (!stored || models.some(model => model.id === stored)) return models
  return [{ id: stored, name: stored }, ...models]
}

/** Per-family generation settings. Today: which model the generator preselects. */
export function ModelFamilySettings({ family }: { family: ModelFamily }) {
  const { t } = useTranslation()
  const fetched = useFamilyModels(family)
  const plan = usePlanAccess()
  const refusalFor = usePlanRefusal(plan)
  const stored = useSettings(state => state.settings.generation.defaultModels)
  const stageBranch = useSettingsDraft(state => state.stageBranch)
  // Staged like every other setting: this screen writes a branch no path can name, which is
  // exactly what `stageBranch` exists for — it must not slip past Apply on its own. Its absence
  // from `touched` is also why the dot is read from the buffer rather than from the leaf set.
  const pendingModels = useSettingsDraft(state => state.pending.generation?.defaultModels)

  const defaultModels = pendingModels ?? stored
  const selected = defaultModels[family] ?? ''
  const models = withStored(fetched, selected)

  const stageFamily = (id: string): void => {
    // "Ask every time" is the absence of a key, not an empty model id — which the main
    // process would reject.
    const next = { ...defaultModels }
    if (id) next[family] = id
    else delete next[family]
    stageBranch({ generation: { defaultModels: next } })
  }

  /**
   * The default that is ALREADY stored, which nobody is choosing right now. A downgrade or an
   * account switch can put it out of plan, and a browser still shows a disabled `<option>` as
   * the selected one — silently, since the suffix only lives in the option labels. The
   * generator would then open armed on it and fail on every submission.
   */
  const selectedModel = models.find(model => model.id === selected)
  const selectedRefusal = refusalFor(selectedModel?.requiredPlanLevel)

  const id = `setting-default-model-${family}`

  return (
    <div className={SETTING_COLUMN}>
      <SettingLine
        title={t('settings.defaultModel')}
        labelFor={id}
        // This family's own leaf, never the buffer's presence: one branch carries all seven, so
        // staging a default for images would otherwise mark the video line modified too.
        staged={pendingModels !== undefined && pendingModels[family] !== stored[family]}
        stagedLabel={t('settings.modified')}
        help={selectedRefusal && <p className="text-warning text-xs">{selectedRefusal}</p>}
      >
        <select
          id={id}
          className={SETTING_SELECT}
          value={selected}
          onChange={event => stageFamily(event.target.value)}
        >
          <option value="">{t('settings.noDefaultModel')}</option>
          <ModelOptions models={models} plan={plan} />
        </select>

        {/* The factory value is "ask every time" for every family — `defaultModels` ships empty. */}
        <SettingRestoreButton restorable={selected !== ''} onRestore={() => stageFamily('')} />
      </SettingLine>
    </div>
  )
}
