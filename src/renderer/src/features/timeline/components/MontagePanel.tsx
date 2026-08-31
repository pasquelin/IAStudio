import { TimelineCanvas } from '@/spaces/video/TimelineCanvas'
import { useVideoTool } from '@/stores/videoTool'
import { TrackHeaders } from './Track/Headers/TrackHeaders'

export type MontagePanelProps = {
  documentId: string
  /** Passed straight through to the strip — see `TimelineCanvasProps.history`. */
  history?: boolean
}

/**
 * A montage: the header column, and the strip beside it.
 *
 * Two workspaces mount this — a sequence in Video, a sound montage in Audio — and they mount the
 * SAME one on purpose. What differs between them is what the montage holds, never how it is
 * worked: a clip is dragged, trimmed and faded identically whether it carries a picture or not.
 */
export function MontagePanel({ documentId, history }: MontagePanelProps) {
  const tool = useVideoTool(state => state.tool)

  return (
    <div className="flex h-full min-h-0">
      <TrackHeaders documentId={documentId} />
      <div className="min-w-0 flex-1">
        <TimelineCanvas documentId={documentId} tool={tool} history={history} />
      </div>
    </div>
  )
}
