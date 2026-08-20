import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { toDegrees } from '@shared/domain/angles'
import { familyStack } from '@/engines/canvas/canvasFonts'
import { setLayerText } from '@/engines/canvas/commands'
import { hexOf } from '@/engines/core/palette'
import { toScreen, type Viewport } from '@/engines/canvas/viewport'
import type { TextLayer } from '@/engines/canvas/canvasState'
import { useCanvases } from '@/stores/canvases'
import { useDocumentEdit } from '@/hooks/useDocumentEdit'

export type ImageDocumentTextProps = {
  documentId: string
  layer: TextLayer
  viewport: Viewport
  /** What the rulers take from the top and the left, which the host's origin sits after. */
  inset: number
  label: string
  onDone: () => void
}

/**
 * The caption being typed, as a field laid exactly over the box it will occupy. A DOM field
 * rather than a caret painted into the canvas: the browser already knows about dead keys, input
 * methods, selection by pointer and the system clipboard, and none of the four are worth rewriting.
 *
 * The layer's own sprite steps aside while this is up — see `CanvasEngine.setEditingText` — so the
 * words are drawn once and by one thing.
 */
export function ImageDocumentText({
  documentId,
  layer,
  viewport,
  inset,
  label,
  onDone,
}: ImageDocumentTextProps) {
  const field = useRef<HTMLTextAreaElement>(null)
  const edit = useDocumentEdit(useCanvases, documentId)

  // The whole of a typing session is ONE history entry: a command per keystroke would evict
  // everything before it from the stack.
  useEffect(() => {
    field.current?.focus()
    field.current?.select()
    const store = useCanvases.getState()
    store.beginGesture(documentId)
    return () => store.endGesture(documentId)
  }, [documentId])

  const at = toScreen(viewport, layer.transform)
  const style: CSSProperties = {
    left: at.x + inset,
    top: at.y + inset,
    width: layer.box.width * viewport.scale,
    height: layer.box.height * viewport.scale,
    // Around the top-left corner, which is where the engine places the words themselves.
    transformOrigin: '0 0',
    transform: `rotate(${toDegrees(layer.transform.rotation)}deg) scale(${layer.transform.scaleX}, ${layer.transform.scaleY})`,
    fontFamily: familyStack(layer.font),
    fontSize: layer.size * viewport.scale,
    lineHeight: `${layer.size * layer.lineHeight * viewport.scale}px`,
    letterSpacing: (layer.tracking / 1000) * layer.size * viewport.scale,
    textAlign: layer.align,
    color: hexOf(layer.color),
  }

  const finish = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Escape ends the session; Enter does not, since a caption has lines. That is Photoshop's
    // split too, and the one place a text field must not answer Enter with a commit.
    if (event.key === 'Escape') onDone()
  }

  return (
    <textarea
      ref={field}
      aria-label={label}
      value={layer.text}
      onChange={event => edit.run(setLayerText(layer.id, { text: event.target.value }))}
      onKeyDown={finish}
      onBlur={onDone}
      spellCheck={false}
      style={style}
      // No border and no padding: every pixel of the box is where the words go, or the field and
      // the layer under it would disagree about where the first letter starts. Overflow is
      // visible on purpose — a caption that outgrows its box spills past it.
      className="absolute resize-none overflow-visible border-0 bg-transparent p-0 outline-0"
    />
  )
}
