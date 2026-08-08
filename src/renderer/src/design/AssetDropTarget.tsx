import { useState, type ReactNode } from 'react'
import type { Asset, AssetType } from '@shared/domain/asset'
import { carriesAsset, draggedAsset, draggedAssetType } from '@/helpers/asset-drag'
import { cn } from '@/helpers/cn'

export type AssetDropTargetProps = {
  /** The kinds this target takes. A drag announcing none is taken anyway — see below. */
  accepts: readonly AssetType[]
  onDrop: (asset: Asset) => void
  /** For a target sitting inside another: the surface behind must not receive the drop too. */
  exclusive?: boolean
  className?: string
  children: ReactNode
}

/**
 * A surface an asset can be dropped onto, with the two halves every one of them got wrong.
 *
 * First: `preventDefault` on `dragover` is what makes a drop possible at all, and calling it
 * unconditionally means the surface swallows files dragged in from the desktop. It is called
 * only for drags that carry one of ours, and only for a kind this target would take.
 *
 * Second: the target says whether it would accept WHILE the asset is still flying. That needs
 * the kind, which is why the drag announces it in its MIME type — `getData` answers nothing
 * before the drop, so a target reading the asset would be painting after the fact. A drag that
 * announces no kind is accepted rather than refused: a drop that silently does nothing is worse
 * than one that lands somewhere sensible.
 */
export function AssetDropTarget({
  accepts,
  onDrop,
  exclusive,
  className,
  children,
}: AssetDropTargetProps) {
  const [state, setState] = useState<'idle' | 'over' | 'refused'>('idle')

  return (
    <div
      className={cn(
        className,
        state !== 'idle' && 'outline-2 -outline-offset-2',
        state === 'over' && 'outline-accent',
        // Refusal is drawn too: a target that stays blank while nothing can happen reads as a
        // broken drop rather than as an answer.
        state === 'refused' && 'outline-danger',
      )}
      onDragOver={event => {
        if (!carriesAsset(event)) return
        if (exclusive) event.stopPropagation()

        const kind = draggedAssetType(event)
        const welcome = kind === null || accepts.includes(kind)
        if (welcome) event.preventDefault()
        setState(welcome ? 'over' : 'refused')
      }}
      onDragLeave={event => {
        // `dragleave` bubbles from every child: crossing from the canvas onto the toolbar above
        // it is not leaving the target, and answering it would flicker the outline all drag long.
        const to = event.relatedTarget
        if (to instanceof Node && event.currentTarget.contains(to)) return
        setState('idle')
      }}
      onDrop={event => {
        event.preventDefault()
        if (exclusive) event.stopPropagation()
        setState('idle')

        const asset = draggedAsset(event)
        if (asset) onDrop(asset)
      }}
    >
      {children}
    </div>
  )
}
