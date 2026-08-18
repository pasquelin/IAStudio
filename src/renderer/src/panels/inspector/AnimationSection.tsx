import { mdiPause, mdiPlay } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  clipLane,
  DEFAULT_CLIP,
  embeddedClip,
  MAIN_LANE_ID,
  ROOT_MOTIONS,
  type ClipRef,
  type ClipSource,
  type RootMotion,
} from '@shared/domain/scene'
import { secondsToUs, usToSeconds } from '@shared/domain/time'
import { AnimationPicker } from '@/design/AnimationPicker/AnimationPicker'
import { BODY_PARTS, isBodyPart, WHOLE_BODY, type BodyPart } from '@shared/domain/humanoid'
import { PropertyRow } from '@/design/PropertyRow'
import { PropertySection } from '@/design/PropertySection'
import { QuietNote } from '@/design/QuietNote'
import { SliderField } from '@/design/SliderField'
import { INLINE_LINK, NATIVE_SELECT } from '@/design/styles'
import { ToggleField } from '@/design/ToggleField'
import { ToolButton } from '@/design/ToolButton'
import { addModelClip, removeModelClip, setModelLanes } from '@/engines/scene/commands'
import { animationViewOf, useAnimationViews } from '@/stores/animationView'
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

/** Seconds. Past a second a transition stops reading as one move joining another. */
const MAX_FADE = 1

/** A `<select>` answers a string; the whole body is what anything else can only have meant. */
const bodyPartRead = (value: string): BodyPart => (isBodyPart(value) ? value : WHOLE_BODY)

/** Same contract: `auto` is what a value the studio did not write can only have meant. */
const rootMotionRead = (value: string): RootMotion =>
  ROOT_MOTIONS.find(motion => motion === value) ?? 'auto'

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
  const preview = useSceneViews(state => sceneViewOf(state, documentId).preview)
  const picked = useAnimationViews(state => animationViewOf(state, documentId).pickedBlock)
  const [open, setOpen] = useState(false)
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  /** The block the picker laid while browsing, so keeping it is doing nothing more. */
  const [picking, setPicking] = useState<{ clipId: string; source: ClipSource } | null>(null)

  // Nothing has landed yet: a section explaining a model the studio has not read would be wrong
  // rather than empty.
  if (!rig) return null

  const lanes = node.model.lanes ?? []
  // THE BLOCK ONE CHOSE on the band, and the first one only while nothing is chosen: a model may
  // hold several, and a section that always described the first could not speak of the others.
  const played =
    lanes.flatMap(lane => lane.clips).find(clip => clip.id === picked) ?? lanes[0]?.clips[0] ?? null

  const running = preview?.clipId === played?.id && played !== null

  /**
   * Watches the chosen block on a clock of its OWN, in the viewport, leaving the band where it
   * was left. Looking at one animation is not moving the scene's clock.
   */
  const play = (clip: ClipRef | null): void => {
    useSceneViews
      .getState()
      .setPreview(documentId, clip ? { nodeId: node.id, clipId: clip.id } : null)
  }

  // The chosen block is replaced INSIDE its own lane, every other lane carried over untouched:
  // rewriting the whole field from one control would drop every block this section does not show.
  const write = (next: ClipRef | null): void => {
    const holding = lanes.find(lane => lane.clips.some(clip => clip.id === played?.id)) ?? lanes[0]
    const clips = holding?.clips ?? []
    // Rewritten IN PLACE: a block moved to the front of its lane because a speed changed would
    // reorder what the band draws.
    const rewritten = clipLane(
      holding?.id ?? MAIN_LANE_ID,
      next === null
        ? clips.filter(clip => clip.id !== played?.id)
        : played
          ? clips.map(clip => (clip.id === played.id ? next : clip))
          : [...clips, next],
    )

    edit.run(
      setModelLanes(
        node.id,
        lanes.length > 0
          ? lanes.map(lane => (lane.id === rewritten.id ? rewritten : lane))
          : [rewritten],
      ),
    )
  }

  // Picking a clip on a model that had none starts from the defaults rather than from nothing,
  // and plays at once: a chosen clip standing at its first frame would read as a control that
  // did not work.
  const choose = (name: string): void => {
    const next = name === '' ? null : embeddedClip(played?.id ?? newId(), name, { ...played })
    write(next)
    play(next)
  }

  /** Lays what the picker chose, plays it at once, and remembers which block that was. */
  const browse = (source: ClipSource, label: string): void => {
    const laid = { ...DEFAULT_CLIP, id: newId(), source, label }
    if (picking?.clipId) edit.run(removeModelClip(node.id, picking.clipId))
    edit.run(addModelClip(node.id, laid))
    setPicking({ clipId: laid.id, source })
    play(laid)
  }

  /** Leaves the block where it is, and stops watching it: keeping is doing nothing more. */
  const keep = (): void => {
    setPicking(null)
    play(null)
  }

  const drop = (): void => {
    if (picking?.clipId) edit.run(removeModelClip(node.id, picking.clipId))
    setPicking(null)
    play(null)
  }

  return (
    <PropertySection title={t('inspector.animation')}>
      <QuietNote>{t(`inspector.rigStatus_${rig.status}`)}</QuietNote>

      {/* The one way in, and it browses by LAYING: the preview is the result, never a rehearsal. */}
      <button ref={setOpener} type="button" className={INLINE_LINK} onClick={() => setOpen(!open)}>
        {t('inspector.addAnimation')}
      </button>
      {open && (
        <AnimationPicker
          documentId={documentId}
          nodeId={node.id}
          anchor={opener}
          laid={picking}
          onChoose={browse}
          onKeep={() => {
            keep()
            setOpen(false)
          }}
          onDismiss={() => {
            drop()
            setOpen(false)
          }}
        />
      )}

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
              onClick={() => play(running ? null : played)}
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
          {/* One value for both edges: what is being set is how this move JOINS its neighbours,
              and a block whose two ends faded differently would have no such thing. */}
          <SliderField
            label={t('inspector.clipFade')}
            value={usToSeconds(played.fadeIn)}
            min={0}
            max={MAX_FADE}
            step={0.05}
            onChange={seconds =>
              write({ ...played, fadeIn: secondsToUs(seconds), fadeOut: secondsToUs(seconds) })
            }
            {...edit.gesture}
          />
          <PropertyRow label={t('inspector.clipRootMotion')}>
            <select
              aria-label={t('inspector.clipRootMotion')}
              value={played.rootMotion}
              onChange={event =>
                write({ ...played, rootMotion: rootMotionRead(event.target.value) })
              }
              className={cn(NATIVE_SELECT, 'w-full')}
            >
              {ROOT_MOTIONS.map(motion => (
                <option key={motion} value={motion}>
                  {t(`inspector.rootMotion_${motion}`)}
                </option>
              ))}
            </select>
          </PropertyRow>
          {/* What makes two blocks stack rather than average each other out. A select for the
              same reason as the clip picker above: the OS list reads on its own. */}
          <PropertyRow label={t('inspector.clipPart')}>
            <select
              aria-label={t('inspector.clipPart')}
              value={played.part ?? WHOLE_BODY}
              onChange={event => write({ ...played, part: bodyPartRead(event.target.value) })}
              className={cn(NATIVE_SELECT, 'w-full')}
            >
              {BODY_PARTS.map(part => (
                <option key={part} value={part}>
                  {t(`inspector.clipPart_${part}`)}
                </option>
              ))}
            </select>
          </PropertyRow>
        </>
      )}
    </PropertySection>
  )
}
