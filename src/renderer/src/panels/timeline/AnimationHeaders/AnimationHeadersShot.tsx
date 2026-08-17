import { mdiChevronDown, mdiChevronUp } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { editCameraShot } from '@/engines/scene/animationCommands'
import type { ShotRow } from '@/engines/scene/animationRows'
import { HINT_RIGHT, TIP_RIGHT } from '@/helpers/tooltip'
import { animationViewOf, useAnimationViews } from '@/stores/animationView'
import { useScenes } from '@/stores/scenes'
import { TimelineRow } from '../TimelineRow/TimelineRow'

/**
 * One layer of shots: what it is called, and the two buttons that send the picked shot to the
 * layer above or below.
 *
 * The buttons act on the PICKED shot rather than on the line, because a line can hold several
 * and a layer as a whole is not a thing one moves — moving them all would leave the stack in
 * exactly the order it was.
 */
export function AnimationHeadersShot({ documentId, row }: { documentId: string; row: ShotRow }) {
  const { t } = useTranslation()
  const picked = useAnimationViews(state => animationViewOf(state, documentId).selectedShotId)
  const shot = row.bars.find(bar => bar.shot.id === picked)?.shot ?? null
  const name = t('animation.shotLayer', { layer: row.layer })

  const send = (by: number): void => {
    if (shot) {
      useScenes
        .getState()
        .runCommand(documentId, editCameraShot(shot.id, { layer: shot.layer + by }))
    }
  }

  return (
    <TimelineRow height={row.height} nested data-testid={`anim-shots-${row.layer}`}>
      <div className="flex items-center gap-0.5">
        <span className="text-muted text-tiny min-w-0 flex-1 truncate" {...HINT_RIGHT(name)}>
          {name}
        </span>
        <ToolButton
          icon={mdiChevronUp}
          label={t('animation.raiseShot')}
          tooltip={TIP_RIGHT}
          variant="header"
          disabled={!shot}
          onClick={() => send(1)}
        />
        <ToolButton
          icon={mdiChevronDown}
          label={t('animation.lowerShot')}
          tooltip={TIP_RIGHT}
          variant="header"
          disabled={!shot}
          onClick={() => send(-1)}
        />
      </div>
    </TimelineRow>
  )
}
