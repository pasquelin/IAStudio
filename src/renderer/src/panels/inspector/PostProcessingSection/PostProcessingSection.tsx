import {
  mdiCompare,
  mdiExport,
  mdiImport,
  mdiContentSave,
  mdiRhombus,
  mdiRhombusOutline,
} from '@mdi/js'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  POST_CATEGORIES,
  POST_EFFECT_IDS,
  POST_EFFECTS,
  type PostEffectId,
  type PostStack,
} from '@shared/domain/postProcessing'
import { POST_PRESET_IDS, stackFromPreset, type PostPresetId } from '@shared/domain/postPresets'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { PropertySection } from '@/design/PropertySection'
import { SelectField } from '@/design/SelectField'
import { ToggleField } from '@/design/ToggleField'
import { ToolButton } from '@/design/ToolButton'
import { EmptyState } from '@/design/EmptyState'
import { postEffectFields } from '@/engines/scene/propertyFields'
import {
  addPostEffect,
  applyPostStack,
  duplicatePostEffect,
  keyPostParam,
  postChannelOf,
  removePostEffectWholly,
  reorderPostEffects,
  resetPostEffect,
  setPostEffectEnabled,
  setPostEnabled,
  setPostParam,
  unkeyPostParam,
  type PostTargetRef,
} from '@/engines/scene/postCommands'
import { postAt } from '@/engines/scene/animationEval'
import { keyAt } from '@/engines/scene/animationEval'
import type { SceneEdit } from '@/hooks/useSceneEdit'
import { newId } from '@/helpers/ids'
import { sceneKeyingAt } from '@/helpers/sceneKeyingAt'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { usePostPresets } from '@/stores/postPresets'
import { HINT_LEFT, HINT_RIGHT, TIP_LEFT } from '@/helpers/tooltip'
import { DescriptorSection } from '../DescriptorSection'
import { PostStackList } from './PostStackList'
import { exportPostPreset, importPostPreset } from './postPresetIo'

export type PostProcessingSectionProps = {
  documentId: string
  /** Whose composition this is — the scene's, or a camera that overrides it. */
  target: PostTargetRef
  /** What the panel shows and edits. Read by the caller, which knows where it lives. */
  stack: PostStack
  /** The subject its channels are keyed under — see `postSubjectOf`. */
  subject: string
  edit: SceneEdit
  title: string
}

/**
 * A composition, edited.
 *
 * Generated from the catalogue and nothing else: the rows come from the stack, the controls of
 * the selected effect come from `POST_EFFECTS`, and adding an effect to the union is all it takes
 * for it to appear here with its own knobs. Not one line below knows what a bloom is.
 */
export function PostProcessingSection({
  documentId,
  target,
  stack,
  subject,
  edit,
  title,
}: PostProcessingSectionProps) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const saved = usePostPresets(state => state.saved)

  const selected = stack.effects.find(effect => effect.id === selectedId) ?? null
  // Read through the evaluator the viewport draws with, so a keyed parameter shows the number
  // that is on screen rather than the one the document stores — the rule `lensAt` already sets.
  const shown = useMemo(() => {
    const keying = sceneKeyingAt(documentId)
    return postAt(stack, keying.state.animation, subject, keying.at)
  }, [documentId, stack, subject])
  const fields = useMemo(() => {
    const live = selected && shown.effects.find(effect => effect.id === selected.id)
    return live ? postEffectFields(live) : []
  }, [selected, shown])

  const effectOptions = useMemo(
    () =>
      POST_EFFECT_IDS.map(id => ({
        value: id,
        label: t(`postfx.effect_${id}`),
        group: t(`postfx.category_${POST_EFFECTS[id].category}`),
      })).sort(
        (left, right) =>
          POST_CATEGORIES.indexOf(POST_EFFECTS[left.value].category) -
          POST_CATEGORIES.indexOf(POST_EFFECTS[right.value].category),
      ),
    [t],
  )

  const presetOptions = useMemo(
    () => [
      ...POST_PRESET_IDS.map(id => ({
        value: id as string,
        label: t(`postfx.preset_${id}`),
        group: t('postfx.builtIn'),
      })),
      ...saved.map(preset => ({
        value: preset.id,
        label: preset.name,
        group: t('postfx.userPresets'),
      })),
    ],
    [saved, t],
  )

  const applyPreset = (id: string): void => {
    const mine = saved.find(preset => preset.id === id)
    const next = mine ? mine.stack : stackFromPreset(id as PostPresetId, newId)
    edit.run(applyPostStack(target, next))
    setSelectedId(null)
  }

  /** The diamond that opens a channel on one parameter, and the state it reports. */
  const keyAction = (name: string): ReactNode | null => {
    const effect = selected
    const spec = effect ? POST_EFFECTS[effect.effect].params[name] : undefined
    if (!effect || !spec?.animatable) return null

    const keying = sceneKeyingAt(documentId)
    const channel = postChannelOf(keying.state, target, effect.id, name)
    const keyed = channel !== undefined && keyAt(channel.keys, keying.at) !== undefined
    const value = shown.effects.find(one => one.id === effect.id)?.params[name]

    return (
      <ToolButton
        icon={keyed ? mdiRhombus : mdiRhombusOutline}
        label={keyed ? t('postfx.unkey') : t('postfx.key')}
        tooltip={TIP_LEFT}
        variant="row"
        told={keyed}
        onClick={() => {
          const now = sceneKeyingAt(documentId)
          const command = keyed
            ? unkeyPostParam(now.state, target, effect.id, name, now.at)
            : typeof value === 'number'
              ? keyPostParam(
                  now.state,
                  target,
                  effect.id,
                  name,
                  now.at,
                  value,
                  `${t(`postfx.effect_${effect.effect}`)} · ${t(`postfx.param_${name}`, name)}`,
                )
              : null
          if (command) edit.run(command)
        }}
      />
    )
  }

  return (
    <>
      <PropertySection title={title} scId="postfx">
        <ToggleField
          label={t('postfx.enabled')}
          scId="postfx.enabled"
          value={stack.enabled}
          onChange={enabled => edit.run(setPostEnabled(target, enabled))}
          action={
            <ToolButton
              icon={mdiCompare}
              label={t('postfx.bypass')}
              description={t('postfx.bypassHint')}
              tooltip={TIP_LEFT}
              variant="row"
              acts
              // Held rather than toggled, and it never reaches the document: § 2 asks for a look
              // at what is underneath, not for an edit ⌘Z would have to take back.
              onPointerDown={() => sceneEngineOf(documentId)?.setPostBypassed(true)}
              onPointerUp={() => sceneEngineOf(documentId)?.setPostBypassed(false)}
              onPointerLeave={() => sceneEngineOf(documentId)?.setPostBypassed(false)}
            />
          }
        />

        <SelectField
          label={t('postfx.preset')}
          scId="postfx.preset"
          // No preset is ever the value: applying one BUILDS a stack, so what is shown afterwards
          // is a composition and not a reference — a document that pointed at a preset would
          // change look the day the preset did.
          value={null}
          unnamedLabel={t('postfx.presetNone')}
          options={presetOptions}
          onChange={applyPreset}
          hint={HINT_LEFT(t('postfx.presetHint'))}
          actions={
            <MenuButton
              icon={mdiContentSave}
              label={t('postfx.presetSave')}
              description={t('postfx.presetSaveHint')}
              tooltip={TIP_LEFT}
              variant="row"
              rowCount={3}
              opensOnClick
              rows={close => (
                <>
                  <MenuRow
                    label={t('postfx.presetSave')}
                    icon={mdiContentSave}
                    tip={HINT_RIGHT(t('postfx.presetSaveHint'))}
                    onSelect={() => {
                      close()
                      usePostPresets.getState().savePostPreset(title, stack)
                    }}
                  />
                  <MenuRow
                    label={t('postfx.presetImport')}
                    icon={mdiImport}
                    tip={HINT_RIGHT(t('postfx.presetImportHint'))}
                    onSelect={() => {
                      close()
                      void importPostPreset((next: PostStack) =>
                        edit.run(applyPostStack(target, next)),
                      )
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
                </>
              )}
            />
          }
        />

        {stack.effects.length === 0 ? (
          <EmptyState icon={mdiRhombusOutline} message={t('postfx.emptyHint')} />
        ) : (
          <PostStackList
            stack={stack}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onReorder={order => edit.run(reorderPostEffects(target, order))}
            onToggle={(id, enabled) => edit.run(setPostEffectEnabled(target, id, enabled))}
            onRemove={id => {
              edit.run(removePostEffectWholly(sceneKeyingAt(documentId).state, target, id))
              if (id === selectedId) setSelectedId(null)
            }}
            onDuplicate={id => edit.run(duplicatePostEffect(target, id))}
            onReset={id => edit.run(resetPostEffect(target, id))}
          />
        )}

        <SelectField
          label={t('postfx.addEffect')}
          scId="postfx.add"
          value={null}
          unnamedLabel={t('postfx.addEffect')}
          options={effectOptions}
          onChange={effect => {
            const id = newId()
            edit.run(addPostEffect(target, effect as PostEffectId, id))
            setSelectedId(id)
          }}
          hint={HINT_LEFT(t('postfx.addEffectHint'))}
        />
      </PropertySection>

      {selected && (
        <DescriptorSection
          title={t(`postfx.effect_${selected.effect}`)}
          scId={`postfx.${selected.effect}`}
          fields={fields}
          labelPrefix="postfx.param_"
          actionFor={keyAction}
          onChange={(name, value) => edit.run(setPostParam(target, selected.id, name, value))}
          gesture={edit.gesture}
        />
      )}
    </>
  )
}
