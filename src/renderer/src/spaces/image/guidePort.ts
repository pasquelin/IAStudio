import type { GuidePort } from '@/engines/canvas/CanvasEngine'
import { addGuide, moveGuide, removeGuide } from '@/engines/canvas/commands'
import { newId } from '@/helpers/ids'
import { useCanvases } from '@/stores/canvases'

/**
 * What the engine is allowed to do to the guides of one document. It builds no id and runs no
 * command of its own — those belong to the document's history, which is React's side of the line.
 *
 * Laying a guide down and dragging it is a single gesture, so both ends emit `addGuide` under one
 * command id and coalesce into one history entry. That is also why `addGuide` replaces rather
 * than appends.
 */
export function guidePort(documentId: string): GuidePort {
  let created: { id: string; axis: 'x' | 'y' } | null = null
  const store = () => useCanvases.getState()

  return {
    add: (axis, position) => {
      const id = newId()
      created = { id, axis }
      store().runCommand(documentId, addGuide({ id, axis, position }))
      return id
    },

    move: (id, position) =>
      store().runCommand(
        documentId,
        created?.id === id
          ? addGuide({ id, axis: created.axis, position })
          : moveGuide(id, position),
      ),

    remove: id => {
      // Dropped back on the ruler it was born from: discarding the entry the gesture just pushed
      // leaves no trace at all, where a remove command would leave two — and where an undo would
      // leave ⌘Y able to bring back the guide the user has just thrown away.
      if (created?.id === id) store().discardLast(documentId)
      else store().runCommand(documentId, removeGuide(id))
    },

    beginDrag: () => store().beginGesture(documentId),

    endDrag: () => {
      created = null
      store().endGesture(documentId)
    },
  }
}
