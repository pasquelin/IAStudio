import { useState, type ReactNode } from 'react'
import type { AssetType } from '@shared/domain/asset'
import { assetIdFromDrag, carriesAsset, draggedAssetType } from '@/helpers/asset-drag'
import { cn } from '@/helpers/cn'

export type AssetDropTargetProps = {
  /**
   * Whether this target would take that kind. Asked DURING the drag, so it gets the kind and
   * not the asset — the identifier is unreadable until the drop itself.
   *
   * A drag from an older surface announces no kind, and `null` arrives instead: taking it is
   * the right answer, since a drop that silently does nothing is worse than one that lands.
   */
  accepts: (type: AssetType | null) => boolean
  onDrop: (assetId: string) => void
  className?: string
  children: ReactNode
}

/**
 * A surface an asset can be dropped onto, with the two halves every one of them got wrong.
 *
 * First: `preventDefault` on `dragover` is what makes a drop possible at all, and calling it
 * unconditionally means the surface swallows files dragged in from the desktop. It is called
 * only for drags that carry one of ours.
 *
 * Second: the target says whether it would accept, WHILE the asset is still flying. That needs
 * the kind, which is why the drag announces it in its MIME type — `getData` answers nothing
 * before the drop, so a target reading the asset would be painting after the fact.
 */
export function AssetDropTarget({ accepts, onDrop, className, children }: AssetDropTargetProps) {
  const [state, setState] = useState<'idle' | 'over' | 'refused'>('idle')

  return (
    <div
      className={cn(
        className,
        state === 'over' && 'outline-accent outline-2 -outline-offset-2',
        // Refusal is drawn too: a target that stays blank while nothing can happen reads as a
        // broken drop rather than as an answer.
        state === 'refused' && 'outline-danger outline-2 -outline-offset-2',
      )}
      onDragOver={event => {
        if (!carriesAsset(event)) return

        const welcome = accepts(draggedAssetType(event))
        // Only a prevented dragover makes a drop land — but preventing one we would refuse
        // would promise something the drop then quietly fails to do.
        if (welcome) event.preventDefault()
        setState(welcome ? 'over' : 'refused')
      }}
      onDragLeave={() => setState('idle')}
      onDrop={event => {
        event.preventDefault()
        setState('idle')

        const assetId = assetIdFromDrag(event)
        if (assetId) onDrop(assetId)
      }}
    >
      {children}
    </div>
  )
}
