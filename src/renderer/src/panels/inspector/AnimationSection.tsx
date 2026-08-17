import { mdiPause, mdiPlay } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { DEFAULT_CLIP, type ClipRef } from '@shared/domain/scene'
import { PropertyRow } from '@/design/PropertyRow'
import { PropertySection } from '@/design/PropertySection'
import { QuietNote } from '@/design/QuietNote'
import { SliderField } from '@/design/SliderField'
import { NATIVE_SELECT } from '@/design/styles'
import { ToggleField } from '@/design/ToggleField'
import { ToolButton } from '@/design/ToolButton'
import { setModelClips } from '@/engines/scene/commands'
import type { ModelNode } from '@/engines/scene/sceneState'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { clipsOfNode, rigOfNode, useModelClips } from '@/stores/modelClips'
import type { SceneEdit } from '@/hooks/useSceneEdit'

export type AnimationSectionProps = {
  documentId: string
  node: ModelNode
  edit: SceneEdit
}

/** How fast a clip may be asked to run. Below zero it would play backwards, which is a lot more. */
const MIN_SPEED = 0.1
const MAX_SPEED = 4

/**
 * What an imported model can be made to play, and what stands in the way when it cannot.
 *
 * Both halves come from the engine and not the document: the clips and the bones live inside the
 * GLB, so a model still loading has neither. Where this section used to take itself off, it now
 * says which of the five states the model is in — a mesh with no skeleton is the one place the
 * studio has something to offer, and silence there read as a feature that did not exist.
 */
export function AnimationSection({ documentId, node, edit }: AnimationSectionProps) {
  const { t } = useTranslation()
  const clips = useModelClips(state => clipsOfNode(state, documentId, node.id))
  const rig = useModelClips(state => rigOfNode(state, documentId, node.id))

  // Nothing has landed yet: a section explaining a model the studio has not read would be wrong
  // rather than empty.
  if (!rig) return null

  const played = node.model.clips?.[0] ?? null
  const write = (next: ClipRef | null): void => edit.run(setModelClips(node.id, next ? [next] : []))

  // Picking a clip on a model that had none starts from the defaults rather than from nothing:
  // a chosen clip that neither plays nor loops would read as a control that did not work.
  const choose = (name: string): void =>
    write(
      name === ''
        ? null
        : {
            ...DEFAULT_CLIP,
            ...played,
            id: played?.id ?? 'clip',
            source: { kind: 'embedded', name },
            label: name,
            playing: true,
          },
    )

  return (
    <PropertySection title={t('inspector.animation')}>
      <QuietNote>{t(`inspector.rigStatus_${rig.status}`)}</QuietNote>

      {clips.length > 0 && (
        <PropertyRow label={t('inspector.clip')}>
          <div className="flex w-full items-center gap-1.5">
            {/* A native select, as the model picker uses one: the OS list is searchable by
                keystroke, and a rig can carry a dozen clips. */}
            <select
              aria-label={t('inspector.clip')}
              value={played?.source.name ?? ''}
              onChange={event => choose(event.target.value)}
              className={cn(NATIVE_SELECT, 'min-w-0 flex-1')}
            >
              <option value="">{t('inspector.noClip')}</option>
              {clips.map(clip => (
                <option key={clip} value={clip}>
                  {clip}
                </option>
              ))}
            </select>

            <ToolButton
              icon={played?.playing ? mdiPause : mdiPlay}
              label={played?.playing ? t('inspector.pauseClip') : t('inspector.playClip')}
              tooltip={TIP_LEFT}
              variant="header"
              disabled={!played}
              onClick={() => played && write({ ...played, playing: !played.playing })}
            />
          </div>
        </PropertyRow>
      )}

      {played && (
        <>
          <SliderField
            label={t('inspector.clipSpeed')}
            value={played.speed}
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={0.1}
            onChange={speed => write({ ...played, speed })}
            {...edit.gesture}
          />
          <ToggleField
            label={t('inspector.clipLoop')}
            value={played.loop}
            onChange={loop => write({ ...played, loop })}
          />
        </>
      )}
    </PropertySection>
  )
}
