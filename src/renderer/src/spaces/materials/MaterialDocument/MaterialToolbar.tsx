import { useMemo } from 'react'
import { PBR_CHANNELS } from '@shared/domain/material'
import { Toolbar } from '@/design/Toolbar/Toolbar'
import { PANE_TOOLBAR } from '@/design/styles'
import { setPreview } from '@/engines/material/commands'
import { PREVIEW_SHAPES, TILING_PREVIEWS } from '@/engines/material/materialState'
import { useDocumentEdit } from '@/hooks/useDocumentEdit'
import {
  channelFrom,
  nextIn,
  nextInspected,
  shapeFrom,
  materialTools,
  tilingFrom,
} from '../materialTools'
import { materialOf, useMaterials } from '@/stores/materials'
import { inspectedChannel, useMaterialViews } from '@/stores/materialViews'

export type MaterialToolbarProps = {
  documentId: string
  /** Puts the camera back where the engine opened it. The engine is the document's, not ours. */
  onFrame: () => void
}

/**
 * How the material in the centre is being LOOKED at. The inspector holds the same values and
 * both write through `setPreview`, so ⌘Z takes back a click of this bar as it does a chip there.
 * The inspected channel is the exception, and session state on purpose.
 */
export function MaterialToolbar({ documentId, onFrame }: MaterialToolbarProps) {
  const preview = useMaterials(state => materialOf(state, documentId).preview)
  const channels = useMaterials(state => materialOf(state, documentId).channels)
  const inspected = useMaterialViews(state => inspectedChannel(state, documentId))
  const edit = useDocumentEdit(useMaterials, documentId)

  const filled = useMemo(
    () => PBR_CHANNELS.filter(channel => channels[channel] !== undefined),
    [channels],
  )

  const inspect = (channel: ReturnType<typeof channelFrom>): void =>
    useMaterialViews.getState().inspect(documentId, channel)

  // Clicking a group steps to its next entry; hovering it shows them all. See `nextIn`.
  const onTool = (id: string): void => {
    if (id === 'shape') return edit.run(setPreview('shape', nextIn(PREVIEW_SHAPES, preview.shape)))
    if (id === 'channel') return inspect(nextInspected(filled, inspected))
    if (id === 'tiling') {
      return edit.run(setPreview('tilingPreview', nextIn(TILING_PREVIEWS, preview.tilingPreview)))
    }
    if (id === 'seam') return edit.run(setPreview('showSeam', !preview.showSeam))
    if (id === 'background') {
      return edit.run(setPreview('showBackground', !preview.showBackground))
    }
    if (id === 'spin') return edit.run(setPreview('autoSpin', !preview.autoSpin))
    if (id === 'frame') onFrame()
  }

  const onMode = (toolId: string, modeId: string): void => {
    if (toolId === 'shape') {
      const shape = shapeFrom(modeId)
      if (shape) edit.run(setPreview('shape', shape))
      return
    }

    // No guard on the row being a channel: the material row is the one that answers `null`, and
    // `null` is exactly what it means — give the lit material back.
    if (toolId === 'channel') return inspect(channelFrom(modeId))

    if (toolId === 'tiling') {
      const times = tilingFrom(modeId)
      if (times) edit.run(setPreview('tilingPreview', times))
    }
  }

  return (
    <Toolbar
      className={PANE_TOOLBAR}
      tools={materialTools({ preview, inspected, filled })}
      onTool={onTool}
      onMode={onMode}
    />
  )
}
