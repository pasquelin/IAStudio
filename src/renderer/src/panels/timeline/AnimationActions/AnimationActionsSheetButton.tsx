import { mdiPlaylistPlus } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { putOnAnimationSheet } from '@/engines/scene/animationCommands'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'

/**
 * Puts what is SELECTED on the band — the door into animating anything at all. The selection
 * rather than a list to pick from: a map of 8 000 objects is not one anybody scrolls through.
 */
export function AnimationActionsSheetButton({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)
  // A `Set`, because this runs on every store change — a marquee over thousands would otherwise
  // pay selection × sheet on each of them.
  const sheet = useScenes(state => sceneOf(state, documentId).animation.sheet)
  const onBand = useMemo(() => new Set(sheet), [sheet])

  return (
    <ToolButton
      icon={mdiPlaylistPlus}
      label={t('animation.addToSheet')}
      description={t('animation.addToSheetHint')}
      tooltip={TIP_BOTTOM}
      variant="header"
      // `[].every()` is true, so an empty selection is already refused by the same test.
      disabled={selectedIds.every(id => onBand.has(id))}
      onClick={() => {
        const state = sceneOf(useScenes.getState(), documentId)
        const command = putOnAnimationSheet(state, selectedIds)
        if (command) useScenes.getState().runCommand(documentId, command)
      }}
    />
  )
}
