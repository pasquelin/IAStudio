import {
  mdiCompare,
  mdiContentSave,
  mdiExport,
  mdiImport,
  mdiRhombus,
  mdiRhombusOutline,
  mdiTrashCanOutline,
} from '@mdi/js'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  POST_CATEGORIES,
  POST_EFFECT_IDS,
  POST_EFFECTS,
  type PostEffectId,
  type PostStack,
} from '@shared/domain/postProcessing'
import { POST_PRESET_IDS } from '@shared/domain/postPresets'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { PropertySection } from '@/design/PropertySection'
import { SelectField } from '@/design/SelectField'
import { ToggleField } from '@/design/ToggleField'
import { ToolButton } from '@/design/ToolButton'
import { EmptyState } from '@/design/EmptyState'
import { postEffectFields } from '@/engines/scene/propertyFields'
import { keyAt, postAt } from '@/engines/scene/animationEval'
import {
  addPostEffect,
  applyPostStack,
  duplicatePostEffect,
  keyPostParam,
  postChannelOf,
  postSubjectOf,
  removePostEffectWholly,
  reorderPostEffects,
  resetPostEffect,
  setPostEffectEnabled,
  setPostEnabled,
  setPostParam,
  stackOfPreset,
  unkeyPostParam,
  type PostTargetRef,
} from '@/engines/scene/postCommands'
import { postChannelName } from '@/helpers/channelNames'
import { newId } from '@/helpers/ids'
import { sceneKeyingAt } from '@/helpers/sceneKeyingAt'
import type { SceneEdit } from '@/hooks/useSceneEdit'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { usePostPresets } from '@/stores/postPresets'
import { HINT_LEFT, HINT_RIGHT, TIP_LEFT } from '@/helpers/tooltip'
import { choicesOf } from '../EnvironmentPanel/environmentChoices'
import { DescriptorSection } from '../DescriptorSection'
import { PostStackList } from './PostStackList'
import { exportPostPreset, importPostPreset } from './postPresetIo'

export type PostProcessingSectionProps = {
  documentId: string
  /** Whose composition this is — the scene's, or a camera that overrides it. */
  target: PostTargetRef
  /** What the panel shows and edits. Read by the caller, which knows where it lives. */
  stack: PostStack
  edit: SceneEdit
  title: string
}

/**
 * Generated from the catalogue: the rows come from the stack, the controls from `POST_EFFECTS`.
 * Adding an effect to the union is all it takes for it to appear with its own knobs.
 */
export function PostProcessingSection({
  documentId,
  target,
  stack,
  edit,
  title,
}: PostProcessingSectionProps) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const saved = usePostPresets(state => state.saved)

  const selected = stack.effects.find(effect => effect.id === selectedId) ?? null
  const subject = postSubjectOf(target)
  // Read once for the whole render: three store reads and a snap, where each field asking for
  // itself paid them again.
  const keying = sceneKeyingAt(documentId)
  // Through the evaluator the viewport draws with, so a keyed parameter shows the number that is
  // on screen rather than the one the document stores — the rule `lensAt` already sets.
  const shown = postAt(stack, keying.state.animation, subject, keying.at)
  const live = selected ? (shown.effects.find(one => one.id === selected.id) ?? null) : null
  const fields = useMemo(() => (live ? postEffectFields(live) : []), [live])

  /** The channels of the SELECTED effect, in one pass over the band rather than one per field. */
  const channels = useMemo(() => {
    const found = new Map<string, ReturnType<typeof postChannelOf>>()
    if (!selected) return found
    for (const name of Object.keys(POST_EFFECTS[selected.effect].params)) {
      found.set(name, postChannelOf(keying.state, target, selected.id, name))
    }
    return found
  }, [keying.state, selected, target])

  const effects = useMemo(() => {
    const ordered = [...POST_EFFECT_IDS].sort(
      (left, right) =>
        POST_CATEGORIES.indexOf(POST_EFFECTS[left].category) -
        POST_CATEGORIES.indexOf(POST_EFFECTS[right].category),
    )
    const named = choicesOf(ordered, 'postfx.effect_', t)
    return {
      ...named,
      options: named.options.map(option => ({
        ...option,
        group: t(`postfx.category_${POST_EFFECTS[option.value].category}`),
      })),
    }
  }, [t])

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

  const run = edit.run

  const applyStack = useCallback(
    (next: PostStack) => {
      run(applyPostStack(target, next))
      setSelectedId(null)
    },
    [run, target],
  )

  /** Stable, so `PostStackRow`'s memo can actually bail out on a stack of ten. */
  const onRemove = useCallback(
    (id: string) => {
      run(removePostEffectWholly(sceneKeyingAt(documentId).state, target, id))
      setSelectedId(held => (held === id ? null : held))
    },
    [documentId, run, target],
  )
  const onDuplicate = useCallback(
    (id: string) => run(duplicatePostEffect(target, id)),
    [run, target],
  )
  const onReset = useCallback((id: string) => run(resetPostEffect(target, id)), [run, target])
  const onToggle = useCallback(
    (id: string, enabled: boolean) => run(setPostEffectEnabled(target, id, enabled)),
    [run, target],
  )
  const onReorder = useCallback(
    (order: readonly string[]) => run(reorderPostEffects(target, order)),
    [run, target],
  )

  /** The diamond that opens a channel on one parameter, and the state it reports. */
  const keyAction = (name: string): ReactNode => {
    const effect = selected
    const spec = effect ? POST_EFFECTS[effect.effect].params[name] : undefined
    if (!effect || !spec?.animatable) return null

    const channel = channels.get(name)
    const keyed = channel !== undefined && keyAt(channel.keys, keying.at) !== undefined
    const value = live?.params[name]

    return (
      <ToolButton
        icon={keyed ? mdiRhombus : mdiRhombusOutline}
        label={keyed ? t('postfx.unkey') : t('postfx.key')}
        tooltip={TIP_LEFT}
        variant="row"
        told={keyed}
        onClick={() => {
          // Read again at press time: the head runs on the wall clock during playback.
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
                  postChannelName(t, effect.effect, name),
                )
              : null
          if (command) run(command)
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
          onChange={enabled => run(setPostEnabled(target, enabled))}
          action={
            <ToolButton
              icon={mdiCompare}
              label={t('postfx.bypass')}
              description={t('postfx.bypassHint')}
              tooltip={TIP_LEFT}
              variant="row"
              acts
              // Held rather than toggled, and it never reaches the document: § 2 asks for a look
              // at what is underneath, not an edit ⌘Z would have to take back.
              onPointerDown={() => sceneEngineOf(documentId)?.setPostBypassed(true)}
              onPointerUp={() => sceneEngineOf(documentId)?.setPostBypassed(false)}
              onPointerLeave={() => sceneEngineOf(documentId)?.setPostBypassed(false)}
            />
          }
        />

        <SelectField
          label={t('postfx.preset')}
          scId="postfx.preset"
          // No preset is ever the VALUE: applying one builds a stack, so what is shown afterwards
          // is a composition — a document pointing at a preset would change look the day it did.
          value={null}
          unnamedLabel={t('postfx.presetNone')}
          options={presets}
          onChange={name => {
            const next = stackOfPreset(name, saved, newId)
            if (next) applyStack(next)
          }}
          hint={HINT_LEFT(t('postfx.presetHint'))}
          actions={
            <MenuButton
              icon={mdiContentSave}
              label={t('postfx.presetSave')}
              description={t('postfx.presetSaveHint')}
              tooltip={TIP_LEFT}
              variant="row"
              rowCount={3 + saved.length}
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
                      void importPostPreset(applyStack)
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
                      key={preset.id}
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

        {stack.effects.length === 0 ? (
          <EmptyState icon={mdiRhombusOutline} message={t('postfx.emptyHint')} />
        ) : (
          <PostStackList
            stack={stack}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onReorder={onReorder}
            onToggle={onToggle}
            onRemove={onRemove}
            onDuplicate={onDuplicate}
            onReset={onReset}
          />
        )}

        <SelectField
          label={t('postfx.addEffect')}
          scId="postfx.add"
          value={null}
          unnamedLabel={t('postfx.addEffect')}
          options={effects.options}
          onChange={(effect: PostEffectId) => {
            const id = newId()
            run(addPostEffect(target, effect, id))
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
          onChange={(name, value) => run(setPostParam(target, selected.id, name, value))}
          gesture={edit.gesture}
        />
      )}
    </>
  )
}
