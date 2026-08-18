import { mdiRunFast } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { Row } from '@/design/Row'
import { FIELD_THUMBNAIL } from '@/design/styles'
import { Thumbnail } from '@/design/Thumbnail'
import { ANIMATION_DRAG_TYPE, type DraggedAnimation } from './dragged'

export type AnimationsPanelRowProps = {
  name: string
  /** Absolute path of `thumb.png`, or nothing — a folder without one shows the generic mark. */
  thumbnail?: string | null
  source: DraggedAnimation
}

/**
 * One animation, dragged onto a sub-track of the band to put a block there. The name is the
 * FOLDER's, never the one inside the clip: a Tripo rig calls its only clip `NlaTrack`.
 */
export function AnimationsPanelRow({ name, thumbnail, source }: AnimationsPanelRowProps) {
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
        media={
          thumbnail ? <Thumbnail url={`file://${thumbnail}`} className={FIELD_THUMBNAIL} /> : null
        }
        icon={thumbnail ? undefined : mdiRunFast}
        subtitle={t('animations.dragHint')}
      />
    </div>
  )
}
