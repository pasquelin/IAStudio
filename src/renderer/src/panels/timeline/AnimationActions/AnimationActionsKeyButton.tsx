import { mdiRhombus } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { snapToFrame } from '@shared/domain/time'
import { ToolButton } from '@/design/ToolButton'
import { keySubject } from '@/engines/scene/animation-commands'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/scene-views'

/**
 * One key on every channel of every animated subject, at the head — Blender's `LocRotScale`.
 *
 * It writes what each channel already stands at, never a neutral: a key holding nothing moves
 * nothing, and that is what made the old diamond button appear to do nothing at all.
 */
export function AnimationActionsKeyButton({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const tracks = useScenes(state => sceneOf(state, documentId).animation.tracks)
  const playhead = useSceneViews(state => sceneViewOf(state, documentId).playhead)

  return (
    <ToolButton
      icon={mdiRhombus}
      label={t('animation.keyAll')}
      description={t('animation.keyAllHint')}
      tooltip={TIP_BOTTOM}
      variant="header"
      disabled={tracks.length === 0}
      onClick={() => {
        const store = useScenes.getState()
        const state = sceneOf(store, documentId)
        const command = keySubject(
          state,
          tracks.map(track => track.id),
          snapToFrame(playhead, state.animation.fps),
        )
        if (command) store.runCommand(documentId, command)
      }}
    />
  )
}
