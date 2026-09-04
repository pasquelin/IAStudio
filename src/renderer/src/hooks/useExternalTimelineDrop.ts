import { useState, type DragEventHandler } from 'react'
import { carriesAsset } from '@/helpers/assetDrag'
import { cn } from '@/helpers/cn'
import type { DropTone } from '@/helpers/drag'
import { carriesScene } from '@/helpers/sceneDrag'
import {
  carriesExternalFiles,
  externalFileTargetTone,
  importExternalFilesInto,
} from '@/services/externalFiles'
import { placeTimelineAsset } from '@/features/video/components/TimelineCanvas/timelineDrop'

type TimelineDropContext = Parameters<typeof placeTimelineAsset>[0]
type TimelineDropHandlers = {
  onDragOver: DragEventHandler<HTMLCanvasElement>
  onDragLeave: DragEventHandler<HTMLCanvasElement>
  onDrop: DragEventHandler<HTMLCanvasElement>
}

export function useExternalTimelineDrop(
  context: TimelineDropContext,
  fallback: DragEventHandler<HTMLCanvasElement>,
): { className: string; handlers: TimelineDropHandlers } {
  const [tone, setTone] = useState<DropTone | null>(null)
  return {
    className: cn(
      tone === 'accepted' && 'outline-accent outline-2 -outline-offset-2',
      tone === 'refused' && 'outline-danger outline-2 -outline-offset-2',
    ),
    handlers: {
      onDragOver: event => {
        if (carriesAsset(event) || carriesScene(event)) {
          setTone(null)
          event.preventDefault()
          return
        }
        const externalTone = externalFileTargetTone(event, ['video', 'audio', 'image'])
        if (!externalTone) return
        setTone(externalTone)
        event.preventDefault()
        event.dataTransfer.dropEffect = externalTone === 'accepted' ? 'copy' : 'none'
      },
      onDragLeave: () => setTone(null),
      onDrop: event => {
        setTone(null)
        if (!carriesExternalFiles(event)) return fallback(event)
        event.preventDefault()
        event.stopPropagation()
        const point = context.pointAt(event)
        void importExternalFilesInto(event.dataTransfer.files, ['video', 'audio', 'image'], asset =>
          placeTimelineAsset(context, asset, point),
        )
      },
    },
  }
}
