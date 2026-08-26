import { mdiRecordCircleOutline } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { secondsToUs, usToSeconds, type Us } from '@shared/domain/time'
import { NumberField } from '@/design/NumberField'
import { SelectField } from '@/design/SelectField'
import { ToolButton } from '@/design/ToolButton'
import { setTimelineSettings } from '@/engines/scene/animationCommands'
import { selectedNodes } from '@/engines/scene/sceneState'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { animationViewOf, useAnimationViews } from '@/stores/animationView'
import { bonesOfNode, useModelFiles } from '@/stores/modelFiles'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { TimelineTransport } from '../TimelineTransport'
import { AnimationActionsKeyButton } from './AnimationActionsKeyButton'
import { AnimationActionsSheetButton } from './AnimationActionsSheetButton'
import { AnimationActionsRenderButton } from './AnimationActionsRenderButton'
import { AnimationActionsShotButton } from './AnimationActionsShotButton'

export type AnimationActionsProps = { documentId: string }

/** What a band may be asked to last, in seconds — a frame at the low end, an hour at the top. */
const MIN_DURATION = 0.1
const MAX_DURATION = 3_600

const MIN_FPS = 1
const MAX_FPS = 120

/**
 * The transport and the settings of a scene's animation, rendered by `ToolWindow` on the panel's
 * own title bar — the same place the montage puts its tools, and for the same reason: a band is
 * short, and a row of controls above it costs a row of keys.
 */
export function AnimationActions({ documentId }: AnimationActionsProps) {
  const { t } = useTranslation()
  const timeline = useScenes(state => sceneOf(state, documentId).animation)
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)
  const view = useSceneViews(state => sceneViewOf(state, documentId))
  const autoKey = useAnimationViews(state => animationViewOf(state, documentId).autoKey)

  const anchor = selectedNodes(nodes, selectedIds).at(-1) ?? null
  const bones = useModelFiles(state => bonesOfNode(state, documentId, anchor?.id ?? ''))
  const picked = view.pickedBone
  const [chosen, setChosen] = useState('')

  // The pose mode decides when it has picked one: clicking a bone in the viewport is a clearer
  // statement of intent than a picker two panels away, so it wins over what was chosen there.
  const bone = picked?.nodeId === anchor?.id ? (picked?.bone ?? chosen) : chosen

  const write = (settings: Partial<{ duration: Us; fps: number }>): void =>
    useScenes.getState().runCommand(documentId, setTimelineSettings(settings))

  // Typing is one gesture: a rate written digit by digit must cost one undo, not one per
  // keystroke — which is what the field's own comment promises.
  const gesture = {
    onGestureStart: () => useScenes.getState().beginGesture(documentId),
    onGestureEnd: () => useScenes.getState().endGesture(documentId),
  }

  // No box of its own: `PanelHeader` already lays its actions out — same gutter, same alignment,
  // and it is the one that knows whether this panel's row may take the free width (`fillActions`).
  // A second flex row inside it was what let this bar space its buttons three times wider than
  // the montage's, on controls of the very same gauge.
  return (
    <>
      <TimelineTransport
        playing={view.playing}
        time={view.playhead}
        fps={timeline.fps}
        onRewind={() => useSceneViews.getState().setPlayhead(documentId, 0)}
        onToggle={() => {
          const views = useSceneViews.getState()
          // Rewound first when the head is already at the end: pressing Play there would stop on
          // the very frame it started, which reads as a button that does nothing.
          if (!view.playing && view.playhead >= timeline.duration) {
            views.setPlayhead(documentId, 0)
          }
          views.setPlaying(documentId, !view.playing)
        }}
      />
      <ToolButton
        icon={mdiRecordCircleOutline}
        label={t('animation.autoKey')}
        description={t('animation.autoKeyHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        active={autoKey}
        onClick={() => useAnimationViews.getState().setAutoKey(documentId, !autoKey)}
      />
      <AnimationActionsSheetButton documentId={documentId} />
      <AnimationActionsKeyButton documentId={documentId} />
      <AnimationActionsShotButton documentId={documentId} />

      <div className="flex-1" />

      {bones.length > 0 && (
        <SelectField
          layout="inline"
          label={t('animation.bone')}
          scId="animation.bone"
          value={bone}
          options={[
            { value: '', label: t('animation.wholeModel') },
            ...bones.map(name => ({ value: name, label: name })),
          ]}
          onChange={setChosen}
          className="max-w-32"
        />
      )}

      <div className="flex w-24 shrink-0 items-center">
        <NumberField
          label={t('animation.duration')}
          scId="animation.duration"
          value={usToSeconds(timeline.duration)}
          min={MIN_DURATION}
          max={MAX_DURATION}
          step={0.1}
          layout="inline"
          onChange={seconds => write({ duration: secondsToUs(seconds) })}
          {...gesture}
        />
      </div>
      <div className="flex w-24 shrink-0 items-center">
        <NumberField
          label={t('animation.fps')}
          scId="animation.fps"
          value={timeline.fps}
          min={MIN_FPS}
          max={MAX_FPS}
          step={1}
          layout="inline"
          onChange={fps => write({ fps })}
          {...gesture}
        />
      </div>

      <AnimationActionsRenderButton documentId={documentId} />
    </>
  )
}
