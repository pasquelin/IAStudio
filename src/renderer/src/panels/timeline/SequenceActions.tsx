import { Toolbar } from '@/design/Toolbar'
import { VIDEO_TOOLS, isVideoTool } from '@/spaces/video/video-tools'
import { useVideoTool } from '@/stores/video-tool'

/** The montage tools. History is the Edit menu's, as it is for every other surface. */
export function SequenceActions() {
  const tool = useVideoTool(state => state.tool)
  const setTool = useVideoTool(state => state.setTool)

  return (
    <Toolbar
      orientation="horizontal"
      className="border-none bg-transparent p-0 shadow-none"
      tools={[...VIDEO_TOOLS]}
      activeTool={tool}
      onTool={id => isVideoTool(id) && setTool(id)}
    />
  )
}
