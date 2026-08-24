import { mdiPause, mdiPlay, mdiRunFast } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { bundledThumbnailUrl } from '@shared/domain/animationLibrary'
import { Row } from '@/design/Row'
import { Thumbnail } from '@/design/Thumbnail'
import { ToolButton } from '@/design/ToolButton'
import { TIP_LEFT } from '@/helpers/tooltip'
import { ANIMATION_DRAG_TYPE, type DraggedAnimation } from './dragged'

export type AnimationsPanelRowProps = {
  name: string
  /** Whether a `thumb.png` sits beside the clip — a folder without one shows the generic mark. */
  thumbnail?: boolean
  source: DraggedAnimation
  /** Whether THIS row is the one being watched, which is what the button offers to stop. */
  playing: boolean
  /** Absent while no character is in front: there is nothing to play a motion on. */
  onPlay?: () => void
}

/**
 * One animation, dragged onto a sub-track of the band to put a block there. The name is the
 * FOLDER's, never the one inside the clip: a Tripo rig calls its only clip `NlaTrack`.
 */
export function AnimationsPanelRow({
  name,
  thumbnail,
  source,
  playing,
  onPlay,
}: AnimationsPanelRowProps) {
  const { t } = useTranslation()

  return (
    <div
      draggable
      // Namespaced, so a file dragged from the desktop is never read as one of these.
      onDragStart={event => {
        event.dataTransfer.setData(ANIMATION_DRAG_TYPE, JSON.stringify(source))
        event.dataTransfer.effectAllowed = 'copy'
      }}
    >
      <Row
        title={name}
        // No thumbnail is the ordinary state, not a failure: a generic mark until someone draws one.
        media={thumbnail ? <Thumbnail url={bundledThumbnailUrl(name)} /> : null}
        icon={thumbnail ? undefined : mdiRunFast}
        subtitle={t('animations.dragHint')}
        actions={
          <ToolButton
            icon={playing ? mdiPause : mdiPlay}
            label={playing ? t('animations.stopPreview') : t('animations.playPreview')}
            tooltip={TIP_LEFT}
            variant="header"
            disabled={!onPlay}
            onClick={() => onPlay?.()}
          />
        }
      />
    </div>
  )
}
