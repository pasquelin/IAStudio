import { mdiPause, mdiPlay } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { embeddedClip, type ClipRef } from '@shared/domain/scene'
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
import { newId } from '@/helpers/ids'
import { TIP_LEFT } from '@/helpers/tooltip'
import { clipsOfNode, rigOfNode, useModelClips } from '@/stores/modelClips'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
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
 * Both halves come from the engine, not the document: clips and bones live inside the GLB, so a
 * model still loading has neither.
 */
export function AnimationSection({ documentId, node, edit }: AnimationSectionProps) {
  const { t } = useTranslation()
  const clips = useModelClips(state => clipsOfNode(state, documentId, node.id))
  const rig = useModelClips(state => rigOfNode(state, documentId, node.id))
  const selfPlay = useSceneViews(state => sceneViewOf(state, documentId).selfPlay)

  // Nothing has landed yet: a section explaining a model the studio has not read would be wrong
  // rather than empty.
  if (!rig) return null

  const held = node.model.clips ?? []
  const played = held[0] ?? null
  const running = Boolean(played && selfPlay?.nodeId === node.id && selfPlay.clipId === played.id)

  // Through the store rather than the document: watching a clip is not an edit, so this leaves
  // neither an undo entry nor a modified flag — see `SelfPlay`.
  const hold = (clip: ClipRef | null): void =>
    useSceneViews
      .getState()
      .setSelfPlay(documentId, clip ? { nodeId: node.id, clipId: clip.id } : null)

  // The played block is replaced WITHIN the list, never made into the list: a document may hold
  // several — the reader accepts them and the band draws them — and rewriting the whole field
  // from one control would drop every block this section does not show.
  const write = (next: ClipRef | null): void => {
    const kept = held.filter(clip => clip.id !== played?.id)
    edit.run(setModelClips(node.id, next ? [next, ...kept] : kept))
  }

  // Picking a clip on a model that had none starts from the defaults rather than from nothing,
  // and is held at once: a chosen clip standing at its first frame would read as a control that
  // did not work.
  const choose = (name: string): void => {
    const next = name === '' ? null : embeddedClip(played?.id ?? newId(), name, { ...played })
    write(next)
    hold(next)
  }

  return (
    <PropertySection title={t('inspector.animation')}>
      <QuietNote>{t(`inspector.rigStatus_${rig.status}`)}</QuietNote>

      {/* Shown for a block whose clip the file no longer spells, too: without the picker its
          « none » option is gone, and a block nothing can play could never be taken off. */}
      {(clips.length > 0 || played) && (
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
              icon={running ? mdiPause : mdiPlay}
              label={running ? t('inspector.pauseClip') : t('inspector.playClip')}
              tooltip={TIP_LEFT}
              variant="header"
              disabled={!played}
              onClick={() => hold(running ? null : played)}
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
