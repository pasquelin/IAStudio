import { mdiPause, mdiPlay } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { DEFAULT_ANIMATION, type AnimationRef } from '@shared/domain/scene'
import { PropertyRow } from '@/design/PropertyRow'
import { PropertySection } from '@/design/PropertySection'
import { SliderField } from '@/design/SliderField'
import { CONTROL } from '@/design/styles'
import { ToggleField } from '@/design/ToggleField'
import { ToolButton } from '@/design/ToolButton'
import { setModelAnimation } from '@/engines/scene/commands'
import type { ModelNode } from '@/engines/scene/scene-state'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { clipsOfNode, useModelClips } from '@/stores/model-clips'
import type { SceneEdit } from './useSceneEdit'

export type AnimationSectionProps = {
  documentId: string
  node: ModelNode
  edit: SceneEdit
}

/** How fast a clip may be asked to run. Below zero it would play backwards, which is a lot more. */
const MIN_SPEED = 0.1
const MAX_SPEED = 4

/**
 * The clips an imported model brought, and which one it plays.
 *
 * The list comes from the engine rather than the document: the names live inside the GLB, so a
 * model still loading offers none — and the section takes itself off rather than showing an
 * empty picker, which is what the studio does everywhere a control would have no effect.
 */
export function AnimationSection({ documentId, node, edit }: AnimationSectionProps) {
  const { t } = useTranslation()
  const clips = useModelClips(state => clipsOfNode(state, documentId, node.id))

  if (clips.length === 0) return null

  const animation = node.model.animation ?? null
  const write = (next: AnimationRef | null): void => edit.run(setModelAnimation(node.id, next))

  // Picking a clip on a model that had none starts from the defaults rather than from nothing:
  // a chosen clip that neither plays nor loops would read as a control that did not work.
  const choose = (clip: string): void =>
    write(clip === '' ? null : { ...DEFAULT_ANIMATION, ...animation, clip, playing: true })

  return (
    <PropertySection title={t('inspector.animation')}>
      <PropertyRow label={t('inspector.clip')}>
        <div className="flex w-full items-center gap-1.5">
          {/* A native select, as the model picker uses one: the OS list is searchable by
              keystroke, and a rig can carry a dozen clips. */}
          <select
            aria-label={t('inspector.clip')}
            value={animation?.clip ?? ''}
            onChange={event => choose(event.target.value)}
            className={cn(CONTROL, 'min-w-0 flex-1 px-1')}
          >
            <option value="">{t('inspector.noClip')}</option>
            {clips.map(clip => (
              <option key={clip} value={clip}>
                {clip}
              </option>
            ))}
          </select>

          <ToolButton
            icon={animation?.playing ? mdiPause : mdiPlay}
            label={animation?.playing ? t('inspector.pauseClip') : t('inspector.playClip')}
            tooltip={TIP_LEFT}
            variant="header"
            disabled={!animation}
            onClick={() => animation && write({ ...animation, playing: !animation.playing })}
          />
        </div>
      </PropertyRow>

      {animation && (
        <>
          <SliderField
            label={t('inspector.clipSpeed')}
            value={animation.speed}
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={0.1}
            onChange={speed => write({ ...animation, speed })}
            {...edit.gesture}
          />
          <ToggleField
            label={t('inspector.clipLoop')}
            value={animation.loop}
            onChange={loop => write({ ...animation, loop })}
          />
        </>
      )}
    </PropertySection>
  )
}
