import { useState, type DragEventHandler } from 'react'
import { cn } from '@/helpers/cn'
import type { DropTone } from '@/helpers/drag'

type ExternalDropFrame = {
  className: string
  onDragOver: DragEventHandler<HTMLDivElement>
  onDragLeave: DragEventHandler<HTMLDivElement>
  onDrop: DragEventHandler<HTMLDivElement>
}

export function useExternalDropFrame(
  toneOf: (event: Parameters<DragEventHandler<HTMLDivElement>>[0]) => DropTone | null,
): ExternalDropFrame {
  const [tone, setTone] = useState<DropTone | null>(null)
  return {
    className: cn(
      'h-full',
      tone === 'accepted' && 'outline-accent outline-2 -outline-offset-2',
      tone === 'refused' && 'outline-danger outline-2 -outline-offset-2',
    ),
    onDragOver: event => setTone(toneOf(event)),
    onDragLeave: event => {
      const next = event.relatedTarget
      if (!(next instanceof Node) || !event.currentTarget.contains(next)) setTone(null)
    },
    onDrop: () => setTone(null),
  }
}
