import { useTranslation } from 'react-i18next'
import { swapShotLayers } from '@/engines/scene/animationCommands'
import { layersSwapped } from '@/engines/scene/cameraShots'
import type { ShotRow } from '@/engines/scene/animationRows'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'
import { TimelineRow } from '../TimelineRow/TimelineRow'

/**
 * One layer of shots, dragged up and down the stack by the grip every other band uses.
 *
 * The LINE moves, never the shot picked on it: a layer is what settles an overlap, and sending
 * one bar out of the line it shares with others would leave the stack exactly as it was.
 */
export function AnimationHeadersShot({ documentId, row }: { documentId: string; row: ShotRow }) {
  const { t } = useTranslation()
  const name = t('animation.shotLayer', { layer: row.layer })

  return (
    <TimelineRow
      height={row.height}
      nested
      reorder={{
        label: t('animation.reorderRow', { name }),
        move: by => {
          const timeline = sceneOf(useScenes.getState(), documentId).animation
          const swap = layersSwapped(timeline, row.layer, by)
          if (!swap) return 0
          useScenes.getState().runCommand(documentId, swapShotLayers(swap.from, swap.to))
          return swap.steps
        },
      }}
      data-testid={`anim-shots-${row.layer}`}
    >
      <span className="text-muted text-tiny min-w-0 flex-1 truncate" {...HINT_RIGHT(name)}>
        {name}
      </span>
    </TimelineRow>
  )
}
