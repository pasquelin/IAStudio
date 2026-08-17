import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Separator } from '@/design/Separator'
import { Toolbar } from '@/design/Toolbar/Toolbar'
import { ToolButton } from '@/design/ToolButton'
import { addTrack } from '@/engines/timeline/commands'
import { TRACK_KINDS, type TrackKind } from '@/engines/timeline/timelineState'
import { tipFor } from '@/helpers/tooltip'
import { VIDEO_TOOLS, isVideoTool } from '@/spaces/video/videoTools'
import { useSequences } from '@/stores/sequences'
import { useVideoTool } from '@/stores/videoTool'
import { TRACK_KIND_ICONS } from './track-flags'

export type SequenceActionsProps = {
  documentId: string
  /**
   * Which kinds of track this montage can grow. A sound montage takes only sound: it has no
   * monitor to show a picture on, and a video track there would be a row nothing ever plays.
   */
  kinds?: readonly TrackKind[]
  /** What sits before the tools — a transport, for a montage with no monitor of its own. */
  lead?: ReactNode
}

/** The montage tools. History is the Edit menu's, as it is for every other surface. */
export function SequenceActions({ documentId, kinds = TRACK_KINDS, lead }: SequenceActionsProps) {
  const { t } = useTranslation()
  const tool = useVideoTool(state => state.tool)
  const setTool = useVideoTool(state => state.setTool)

  // A fragment, not a box: `PanelHeader` already lays its actions out, and a second flex row
  // inside it is how the three timelines came to space their buttons differently.
  return (
    <>
      {lead}
      <Toolbar
        orientation="horizontal"
        className="border-none bg-transparent p-0 shadow-none"
        tools={[...VIDEO_TOOLS]}
        activeTool={tool}
        onTool={id => isVideoTool(id) && setTool(id)}
        /*
         * The two buttons that make a track, in the bar with the tools rather than at the foot of
         * the header column: a montage is started from the top of the panel, and the one place it
         * could be started from sat under the strip, behind whatever the column was scrolled to.
         *
         * Beside the bar rather than inside `tools`, which is what `extras` is for: a tool is
         * ARMED, and every item of that list is announced as a toggle. These two ACT, and a pair
         * of buttons for ever saying "not pressed" describes a state neither of them has.
         */
        extras={
          <>
            <Separator />
            {kinds.map(kind => (
              <ToolButton
                key={kind}
                icon={TRACK_KIND_ICONS[kind]}
                label={t(`timeline.addTrack.${kind}`)}
                description={t(`timeline.addTrackHint.${kind}`)}
                // The bar's own placement and the bar's own gauge: `tipFor('horizontal')` is what
                // its tools take, and a glyph two pixels smaller in an identical box reads as a
                // button that is not quite one of them.
                tooltip={tipFor('horizontal')}
                onClick={() => useSequences.getState().runCommand(documentId, addTrack(kind))}
              />
            ))}
          </>
        }
      />
    </>
  )
}
