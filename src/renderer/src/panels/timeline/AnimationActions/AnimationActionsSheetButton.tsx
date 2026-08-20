import { mdiPlaylistPlus } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { putOnAnimationSheet } from '@/engines/scene/animationCommands'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'

/**
 * Puts what is SELECTED on the band — the door into animating anything at all.
 *
 * The selection rather than a list to pick from, and that is the whole point on a large scene: a
 * map of 8 000 objects is not one anybody scrolls through. One clicks the character in the
 * viewport and presses this.
 */
export function AnimationActionsSheetButton({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)
  const sheet = useScenes(state => sceneOf(state, documentId).animation.sheet)

  return (
    <ToolButton
      icon={mdiPlaylistPlus}
      label={t('animation.addToSheet')}
      description={t('animation.addToSheetHint')}
      tooltip={TIP_BOTTOM}
      variant="header"
      disabled={selectedIds.every(id => sheet.includes(id)) || selectedIds.length === 0}
      onClick={() => {
        const state = sceneOf(useScenes.getState(), documentId)
        const command = putOnAnimationSheet(state, selectedIds)
        if (command) useScenes.getState().runCommand(documentId, command)
      }}
    />
  )
}
