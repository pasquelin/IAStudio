import { mdiPause, mdiPlay } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  clipKeyOf,
  clipLane,
  CLIP_SPEED,
  DEFAULT_CLIP,
  embeddedClip,
  MAIN_LANE_ID,
  MAX_CLIP_FADE,
  ROOT_MOTIONS,
  type ClipRef,
  type ClipSource,
} from '@shared/domain/scene'
import { secondsToUs, usToSeconds } from '@shared/domain/time'
import { AnimationPicker } from '@/features/animation/components/Animation/Picker/AnimationPicker'
import { BODY_PARTS, WHOLE_BODY } from '@shared/domain/humanoid'
import { PropertySection } from '@/components/PropertySection'
import { QuietNote } from '@/components/QuietNote'
import { SelectField } from '@/components/SelectField'
import { SliderField } from '@/components/SliderField'
import { INLINE_LINK } from '@/components/styles'
import { ToggleField } from '@/components/ToggleField'
import { ToolButton } from '@/components/ToolButton'
import { addModelClip, removeModelClip, setModelLanes } from '@/engines/scene/commands'
import { laneHolding, lanesWith } from '@/engines/scene/clipBlend'
import { animationViewOf, useAnimationViews } from '@/stores/animationView'
import type { ModelNode } from '@/engines/scene/sceneState'
import { clipLabel, clipRefLabel } from '@/helpers/clipLabel'
import { newId } from '@/helpers/ids'
import { TIP_LEFT } from '@/helpers/tooltip'
import { clipsOfNode, rigOfNode, useModelFiles } from '@/stores/modelFiles'
import { useScenePreview, useSceneViews } from '@/stores/sceneViews'
import type { SceneEdit } from '@/hooks/useSceneEdit'

export type AnimationSectionProps = {
  documentId: string
  node: ModelNode
  edit: SceneEdit
}

/**
 * What an imported model can be made to play, and what stands in the way when it cannot.
 *
 * Both halves come from the engine, not the document: clips and bones live inside the GLB, so a
 * model still loading has neither.
 */
export function AnimationSection({ documentId, node, edit }: AnimationSectionProps) {
  const { t } = useTranslation()
  const clips = useModelFiles(state => clipsOfNode(state, documentId, node.id))
  const rig = useModelFiles(state => rigOfNode(state, documentId, node.id))
  const preview = useScenePreview(documentId)
  const picked = useAnimationViews(state => animationViewOf(state, documentId).pickedBlock)
  const [open, setOpen] = useState(false)
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  /** The block the picker laid while browsing, so keeping it is doing nothing more. */
  const [picking, setPicking] = useState<{ clipId: string; source: ClipSource } | null>(null)
  /** What was chosen before the picker opened: cancelling puts the band back where it stood. */
  const [chosenBefore, setChosenBefore] = useState<string | null>(null)

  // Nothing has landed yet: a section explaining a model the studio has not read would be wrong
  // rather than empty.
  if (!rig) return null

  const lanes = node.model.lanes ?? []
  const played = lanes.flatMap(lane => lane.clips).find(clip => clip.id === picked) ?? null
  // By KEY and never by name: a bundled `walk` and the clip this file spells `walk` are two
  // different things, and the menu would offer one for the other.
  const playedKey = played && clipKeyOf(played.source)

  const running = played !== null && preview?.clipId === played.id && preview.playing

  /**
   * Watches the chosen block on a clock of its OWN, in the viewport, leaving the band where it
   * was left. Looking at one animation is not moving the scene's clock.
   */
  const play = (clip: ClipRef | null): void => {
    useSceneViews
      .getState()
      .setPreview(
        documentId,
        clip ? { nodeId: node.id, clipId: clip.id, at: 0, playing: true } : null,
      )
  }

  // The chosen block is replaced INSIDE its own lane, every other lane carried over untouched:
  // rewriting the whole field from one control would drop every block this section does not show.
  const write = (next: ClipRef | null): void => {
    // Laying a block is choosing it — every panel here describes the block the band shows chosen.
    useAnimationViews.getState().setPickedBlock(documentId, next?.id ?? null)

    // Rewritten IN PLACE: a block moved to the front of its lane because a speed changed would
    // reorder what the band draws.
    const rewrite = (clips: readonly ClipRef[]): readonly ClipRef[] =>
      next === null
        ? clips.filter(clip => clip.id !== played?.id)
        : played
          ? clips.map(clip => (clip.id === played.id ? next : clip))
          : [...clips, next]

    const holding = laneHolding(lanes, played?.id) ?? lanes[0]
    const written = holding
      ? lanesWith(lanes, holding.id, rewrite)
      : [clipLane(MAIN_LANE_ID, rewrite([]))]

    if (written) edit.run(setModelLanes(node.id, written))
  }

  // Picking a clip on a model that had none starts from the defaults rather than from nothing,
  // and plays at once: a chosen clip standing at its first frame would read as a control that
  // did not work.
  const choose = (key: string): void => {
    // Its own option: rebuilding it would turn a library motion into a clip this file has not got.
    if (key === playedKey) return

    const next = key === '' ? null : embeddedClip(played?.id ?? newId(), key, { ...played })
    write(next)
    play(next)
  }

  // Guarded on the block STILL being there: a ⌘Z takes it out under the picker, and removing what
  // no lane carries banks an entry and wipes the redo.
  const takeBack = (): void => {
    if (picking && laneHolding(lanes, picking.clipId)) {
      edit.run(removeModelClip(node.id, picking.clipId))
    }
  }

  /** Lays what the picker chose, plays it at once, and remembers which block that was. */
  const browse = (source: ClipSource, label: string): void => {
    const laid = { ...DEFAULT_CLIP, id: newId(), source, label }
    takeBack()
    edit.run(addModelClip(node.id, laid))
    useAnimationViews.getState().setPickedBlock(documentId, laid.id)
    setPicking({ clipId: laid.id, source })
    play(laid)
  }

  /** Leaves the block where it is, and stops watching it: keeping is doing nothing more. */
  const keep = (): void => {
    setPicking(null)
    play(null)
  }

  const drop = (): void => {
    takeBack()
    keep()
    useAnimationViews.getState().setPickedBlock(documentId, chosenBefore)
  }

  return (
    <PropertySection title={t('inspector.animation')} scId="animation">
      <QuietNote>{t(`inspector.rigStatus_${rig.status}`)}</QuietNote>

      {/* The one way in, and it browses by LAYING: the preview is the result, never a rehearsal. */}
      <button
        ref={setOpener}
        type="button"
        className={INLINE_LINK}
        onClick={() => {
          if (!open) setChosenBefore(picked)
          setOpen(!open)
        }}
      >
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
          onCancel={() => {
            drop()
            setOpen(false)
          }}
        />
      )}

      {/* Shown for a block whose clip the file no longer spells, too: without the picker its
          « none » option is gone, and a block nothing can play could never be taken off. */}
      {(clips.length > 0 || played) && (
        <SelectField
          label={t('inspector.clip')}
          value={playedKey ?? ''}
          options={[
            { value: '', label: t('inspector.noClip') },
            ...clips.map(clip => ({ value: clip, label: clipLabel(clip, t) })),
            // A motion this file does not spell — a library one, an imported one. Without a row
            // of its own the browser shows the first, and « none » stood over a block that played.
            ...(played && playedKey !== null && !clips.includes(playedKey)
              ? [{ value: playedKey, label: clipRefLabel(played, t) }]
              : []),
          ]}
          onChange={choose}
          scId="animation.clip"
          actions={
            <ToolButton
              icon={running ? mdiPause : mdiPlay}
              label={running ? t('inspector.pauseClip') : t('inspector.playClip')}
              tooltip={TIP_LEFT}
              variant="header"
              disabled={!played}
              onClick={() => play(running ? null : played)}
            />
          }
        />
      )}

      {played && (
        <>
          <SliderField
            label={t('inspector.clipSpeed')}
            scId="animation.clipSpeed"
            value={played.speed}
            min={CLIP_SPEED.min}
            max={CLIP_SPEED.max}
            step={0.1}
            onChange={speed => write({ ...played, speed })}
            {...edit.gesture}
          />
          <ToggleField
            label={t('inspector.clipLoop')}
            scId="animation.clipLoop"
            value={played.loop}
            onChange={loop => write({ ...played, loop })}
          />
          {/* One value for both edges: what is being set is how this move JOINS its neighbours,
              and a block whose two ends faded differently would have no such thing. */}
          <SliderField
            label={t('inspector.clipFade')}
            scId="animation.clipFade"
            value={usToSeconds(played.fadeIn)}
            min={0}
            max={MAX_CLIP_FADE}
            step={0.05}
            onChange={seconds =>
              write({ ...played, fadeIn: secondsToUs(seconds), fadeOut: secondsToUs(seconds) })
            }
            {...edit.gesture}
          />
          <SelectField
            label={t('inspector.clipRootMotion')}
            value={played.rootMotion}
            options={ROOT_MOTIONS.map(motion => ({
              value: motion,
              label: t(`inspector.rootMotion_${motion}`),
            }))}
            onChange={rootMotion => write({ ...played, rootMotion })}
            scId="animation.rootMotion"
          />
          {/* What makes two blocks stack rather than average each other out. A select for the
              same reason as the clip picker above: the OS list reads on its own. */}
          <SelectField
            label={t('inspector.clipPart')}
            value={played.part ?? WHOLE_BODY}
            options={BODY_PARTS.map(part => ({
              value: part,
              label: t(`inspector.clipPart_${part}`),
            }))}
            onChange={part => write({ ...played, part })}
            scId="animation.clipPart"
          />
        </>
      )}
    </PropertySection>
  )
}
