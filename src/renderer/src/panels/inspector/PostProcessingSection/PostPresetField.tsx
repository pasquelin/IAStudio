import { mdiContentSave, mdiExport, mdiImport, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PostStack } from '@shared/domain/postProcessing'
import { POST_PRESET_IDS } from '@shared/domain/postPresets'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { NameField } from '@/design/NameField'
import { PropertyRow } from '@/design/PropertyRow'
import { SelectField } from '@/design/SelectField'
import { stackOfPreset } from '@/engines/scene/postCommands'
import { newId } from '@/helpers/ids'
import { HINT_LEFT, HINT_RIGHT, TIP_LEFT } from '@/helpers/tooltip'
import { usePostPresets } from '@/stores/postPresets'
import { choicesOf } from '../unionChoices'
import { exportPostPreset, importPostPreset } from './postPresetIo'

export type PostPresetFieldProps = {
  /** What a preset saved from here is offered as a name — the composition's own title. */
  title: string
  stack: PostStack
  /** Replaces the whole composition: applying a preset, or reading one back from a file. */
  onApply: (next: PostStack) => void
}

/** Which name is being typed: a preset about to be saved, or one being renamed. */
type Naming = { presetId: string | null }

/**
 * The preset line: pick one, and the menu that saves, renames, deletes, imports and exports.
 *
 * A name is typed IN PLACE of the menu button, the way a branch is named — leaving abandons, so
 * a half-typed name never becomes a preset. `InlineRename` would commit that half on blur.
 */
export function PostPresetField({ title, stack, onApply }: PostPresetFieldProps) {
  const { t } = useTranslation()
  const saved = usePostPresets(state => state.saved)
  const [naming, setNaming] = useState<Naming | null>(null)

  const presets = useMemo(() => {
    const shipped = choicesOf(POST_PRESET_IDS, 'postfx.preset_', t)
    return [
      ...shipped.options.map(option => ({ ...option, group: t('postfx.builtIn') })),
      ...saved.map(preset => ({
        value: preset.id,
        label: preset.name,
        group: t('postfx.userPresets'),
      })),
    ]
  }, [saved, t])

  if (naming) {
    const renamed = saved.find(preset => preset.id === naming.presetId)

    return (
      <PropertyRow label={t('postfx.presetName')}>
        <NameField
          label={t('postfx.presetName')}
          placeholder={renamed?.name ?? title}
          accepts={name => name.trim() !== ''}
          scId="postfx.presetName"
          onSubmit={name => {
            // Handed over untrimmed: the store is what trims and what refuses a blank one, so
            // this field and the MCP handler cannot end up disagreeing on what a name is.
            const store = usePostPresets.getState()
            if (renamed) store.renamePostPreset(renamed.id, name)
            else store.savePostPreset(name, stack)
            setNaming(null)
          }}
          onCancel={() => setNaming(null)}
        />
      </PropertyRow>
    )
  }

  return (
    <SelectField
      label={t('postfx.preset')}
      scId="postfx.preset"
      // No preset is ever the VALUE: applying one builds a stack, so what is shown afterwards
      // is a composition — a document pointing at a preset would change look the day it did.
      // Which is why the resting row spells the GESTURE, and spells REPLACE: a select falling
      // back to a state reads as a pick that did not take, and "apply" leaves open whether the
      // effects already there are kept. They are not — a preset is a whole composition.
      value={null}
      unnamedLabel={t('postfx.presetReplace')}
      options={presets}
      onChange={name => {
        const next = stackOfPreset(name, saved, newId)
        if (next) onApply(next)
      }}
      hint={HINT_LEFT(t('postfx.presetHint'))}
      actions={
        <MenuButton
          icon={mdiContentSave}
          label={t('postfx.presetSave')}
          description={t('postfx.presetSaveHint')}
          tooltip={TIP_LEFT}
          variant="row"
          rowCount={3 + saved.length * 2}
          opensOnClick
          rows={close => (
            <>
              <MenuRow
                label={t('postfx.presetSave')}
                icon={mdiContentSave}
                tip={HINT_RIGHT(t('postfx.presetSaveHint'))}
                onSelect={() => {
                  close()
                  setNaming({ presetId: null })
                }}
              />
              <MenuRow
                label={t('postfx.presetImport')}
                icon={mdiImport}
                tip={HINT_RIGHT(t('postfx.presetImportHint'))}
                onSelect={() => {
                  close()
                  void importPostPreset(onApply)
                }}
              />
              <MenuRow
                label={t('postfx.presetExport')}
                icon={mdiExport}
                tip={HINT_RIGHT(t('postfx.presetExportHint'))}
                onSelect={() => {
                  close()
                  void exportPostPreset(title, stack)
                }}
              />
              {saved.map(preset => (
                <MenuRow
                  key={`rename:${preset.id}`}
                  label={t('postfx.presetRename', { name: preset.name })}
                  icon={mdiPencilOutline}
                  tip={HINT_RIGHT(t('postfx.presetRenameHint'))}
                  onSelect={() => {
                    close()
                    setNaming({ presetId: preset.id })
                  }}
                />
              ))}
              {saved.map(preset => (
                <MenuRow
                  key={`delete:${preset.id}`}
                  label={t('postfx.presetDelete', { name: preset.name })}
                  icon={mdiTrashCanOutline}
                  tip={HINT_RIGHT(t('postfx.presetDeleteHint'))}
                  onSelect={() => {
                    close()
                    usePostPresets.getState().forgetPostPreset(preset.id)
                  }}
                />
              ))}
            </>
          )}
        />
      }
    />
  )
}
