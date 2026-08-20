import { mdiRhombus } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { keySubject } from '@/engines/scene/animationCommands'
import { sceneKeyingAt } from '@/helpers/sceneKeyingAt'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'

/**
 * One key on every channel of every animated subject, at the head — Blender's `LocRotScale`.
 *
 * It writes what each channel already stands at, never a neutral: a key holding nothing moves
 * nothing, and that is what made the old diamond button appear to do nothing at all.
 */
export function AnimationActionsKeyButton({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const tracks = useScenes(state => sceneOf(state, documentId).animation.tracks)

  return (
    <ToolButton
      icon={mdiRhombus}
      label={t('animation.keyAll')}
      description={t('animation.keyAllHint')}
      tooltip={TIP_BOTTOM}
      variant="header"
      disabled={tracks.length === 0}
      onClick={() => {
        const { state, at } = sceneKeyingAt(documentId)
        const command = keySubject(
          state,
          tracks.map(track => track.id),
          at,
        )
        if (command) useScenes.getState().runCommand(documentId, command)
      }}
    />
  )
}
