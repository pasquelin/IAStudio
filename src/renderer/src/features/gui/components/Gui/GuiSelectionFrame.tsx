import type { UiBoxes } from '@shared/domain/ui'
import { toScreen, type Viewport } from '@/engines/canvas/viewport'

export type GuiSelectionFrameProps = {
  boxes: UiBoxes
  selectedIds: readonly string[]
  viewport: Viewport
}

/**
 * What is designated, outlined over the page.
 *
 * In SCREEN space rather than inside the zoomed page: an outline drawn in design pixels thins
 * out to nothing at 10 % and turns into a slab at 800 %. Handles and snapping arrive with the
 * direct-manipulation lot; this is only what says which element the tree and the stage agree on.
 */
export function GuiSelectionFrame({ boxes, selectedIds, viewport }: GuiSelectionFrameProps) {
  return (
    <>
      {selectedIds.map(id => {
        const box = boxes.get(id)
        if (!box) return null

        const at = toScreen(viewport, { x: box.x, y: box.y })
        return (
          <div
            key={id}
            aria-hidden
            data-sc={`section:gui.selection.${id}`}
            className="border-accent pointer-events-none absolute border"
            style={{
              left: at.x,
              top: at.y,
              width: box.width * viewport.scale,
              height: box.height * viewport.scale,
            }}
          />
        )
      })}
    </>
  )
}
