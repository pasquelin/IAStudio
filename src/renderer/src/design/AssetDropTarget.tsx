import { useState, type ReactNode } from 'react'
import type { Asset, AssetType } from '@shared/domain/asset'
import { carriesAsset, draggedAssetType, droppedAsset } from '@/helpers/assetDrag'
import { cn } from '@/helpers/cn'

export type AssetDropTargetProps = {
  /** The kinds this target takes. A drag announcing none is taken anyway — see below. */
  accepts: readonly AssetType[]
  onDrop: (asset: Asset) => void
  /**
   * For a target sitting inside another: the surface behind must not LIGHT UP too.
   *
   * Only the outline — the drop itself is consumed by whichever target takes it, always, so a
   * surface never receives one another surface has already handled.
   */
  exclusive?: boolean
  /**
   * Whether the surface draws a frame while an asset hovers it.
   *
   * On a surface with an edge — a channel slot, a field — the frame IS the answer: it says which
   * of several places the drop would land in. On one that fills the middle of the window there is
   * nothing to choose between, so a frame only outlines what the user is already looking at, and
   * the pointer's own "+" says it better.
   */
  outlined?: boolean
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
  outlined = true,
  className,
  children,
}: AssetDropTargetProps) {
  const [state, setState] = useState<'idle' | 'over' | 'refused'>('idle')

  return (
    <div
      className={cn(
        className,
        outlined && state !== 'idle' && 'outline-2 -outline-offset-2',
        outlined && state === 'over' && 'outline-accent',
        // Refusal is drawn too: a target that stays blank while nothing can happen reads as a
        // broken drop rather than as an answer.
        outlined && state === 'refused' && 'outline-danger',
      )}
      onDragOver={event => {
        if (!carriesAsset(event)) return
        if (exclusive) event.stopPropagation()

        const kind = draggedAssetType(event)
        const welcome = kind === null || accepts.includes(kind)
        if (welcome) {
          event.preventDefault()
          // The pointer's own answer, and the only one an unframed surface gives: "+" means the
          // drop adds something here. Without it the platform shows the arrow of a MOVE, which
          // reads as "this will be taken from where it is".
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
        }
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
        setState('idle')

        /**
         * Asked AGAIN here, and that is the whole point: `dragover` decides the outline, this
         * decides whether the drop is taken — and since the shell mounts a fallback that welcomes
         * every kind, a drop now lands on the deepest target whatever it holds. Reading only the
         * dragover verdict, a surface that had just drawn "refused" would still swallow the drop
         * and rob the fallback of it.
         */
        const kind = draggedAssetType(event)
        if (!carriesAsset(event) || (kind !== null && !accepts.includes(kind))) return

        event.preventDefault()
        // Consumed, which is what lets the shell hold ONE fallback rather than each surface
        // guessing whether it is the last one: what reaches the surface behind is what nobody took.
        event.stopPropagation()

        // Read synchronously, awaited after: a library asset is fetched first, and the event
        // is recycled the moment this handler returns.
        void droppedAsset(event).then(asset => {
          if (asset) onDrop(asset)
        })
      }}
    >
      {children}
    </div>
  )
}
