import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { toDegrees } from '@shared/domain/angles'
import { familyStack } from '@/engines/canvas/canvasFonts'
import { setLayerText } from '@/engines/canvas/commands'
import { colourOf } from '@shared/domain/color'
import { toScreen, type Viewport } from '@/engines/canvas/viewport'
import type { TextLayer } from '@/engines/canvas/canvasState'
import { useCanvases } from '@/stores/canvases'
import { useDocumentEdit } from '@/hooks/useDocumentEdit'

export type ImageDocumentTextProps = {
  documentId: string
  layer: TextLayer
  viewport: Viewport
  label: string
  /** Named, never implied: a click elsewhere opens the NEXT caption before this one lets go. */
  onDone: (layerId: string) => void
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
  label,
  onDone,
}: ImageDocumentTextProps) {
  const field = useRef<HTMLTextAreaElement>(null)
  const edit = useDocumentEdit(useCanvases, documentId)
  /**
   * Whether ⌘ is down. Held, the field stops taking the pointer so the canvas underneath gets
   * the drag and moves the block — the reflex Photoshop, Illustrator and InDesign all answer to,
   * and the only way to place a caption without first stopping typing it.
   */
  const [passing, setPassing] = useState(false)

  // The whole of a typing session is ONE history entry: a command per keystroke would evict
  // everything before it from the stack.
  useEffect(() => {
    field.current?.focus()
    field.current?.select()
    const store = useCanvases.getState()
    store.beginGesture(documentId)
    return () => store.endGesture(documentId)
  }, [documentId])

  /**
   * A point caption's field follows its own words. Measured off `scrollWidth` rather than
   * computed from the font: the browser has already laid the line out, and asking it is the only
   * way to agree with what it drew — a field one letter too narrow would wrap a line that never
   * wraps.
   */
  useEffect(() => {
    const element = field.current
    if (!element || layer.box) return

    element.style.width = '0'
    element.style.width = `${element.scrollWidth}px`
    element.style.height = '0'
    element.style.height = `${element.scrollHeight}px`
  }, [layer.box, layer.text, layer.size, layer.font, layer.tracking, viewport.scale])

  useEffect(() => {
    const read = (event: globalThis.KeyboardEvent): void => setPassing(event.metaKey)
    // `blur` too: the window losing focus never delivers the keyup, and the field would stay
    // deaf to the pointer with nothing on screen saying why.
    const drop = (): void => setPassing(false)

    window.addEventListener('keydown', read)
    window.addEventListener('keyup', read)
    window.addEventListener('blur', drop)
    return () => {
      window.removeEventListener('keydown', read)
      window.removeEventListener('keyup', read)
      window.removeEventListener('blur', drop)
    }
  }, [])

  const at = toScreen(viewport, layer.transform)
  const style: CSSProperties = {
    // No ruler inset here: the viewport is already expressed in the host's frame, rulers
    // included, so adding it again pushed the field 20px off the words it lies over.
    left: at.x,
    top: at.y,
    // A POINT caption is sized by its own words: `auto` on both axes, and the effect below keeps
    // the field just wide enough for the line, which never wraps.
    width: layer.box ? layer.box.width * viewport.scale : 'auto',
    height: layer.box ? layer.box.height * viewport.scale : 'auto',
    whiteSpace: layer.box ? 'pre-wrap' : 'pre',
    // Around the top-left corner, which is where the engine places the words themselves.
    transformOrigin: '0 0',
    transform: `rotate(${toDegrees(layer.transform.rotation)}deg) scale(${layer.transform.scaleX}, ${layer.transform.scaleY})`,
    fontFamily: familyStack(layer.font),
    fontSize: layer.size * viewport.scale,
    lineHeight: `${layer.size * layer.lineHeight * viewport.scale}px`,
    letterSpacing: (layer.tracking / 1000) * layer.size * viewport.scale,
    textAlign: layer.align,
    color: colourOf(layer.color),
    // Held, the drag belongs to the canvas under this field — the focus stays here either way.
    pointerEvents: passing ? 'none' : 'auto',
  }

  const finish = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Escape ends the session; Enter does not, since a caption has lines. That is Photoshop's
    // split too, and the one place a text field must not answer Enter with a commit.
    if (event.key === 'Escape') onDone(layer.id)
  }

  /**
   * A control of the studio taking the focus does NOT end the session — the type panel exists to
   * be read WHILE the caption is typed, and closing on its first click deleted the caption that
   * had not been typed into yet. The canvas focuses nothing, so a click on it still ends it.
   */
  const left = (next: EventTarget | null): void => {
    if (next === null) onDone(layer.id)
  }

  return (
    <textarea
      data-sc="field:canvas.text"
      ref={field}
      aria-label={label}
      value={layer.text}
      onChange={event => edit.run(setLayerText(layer.id, { text: event.target.value }))}
      onKeyDown={finish}
      onBlur={event => left(event.relatedTarget)}
      spellCheck={false}
      style={style}
      // No border and no padding: every pixel of the box is where the words go, or the field and
      // the layer under it would disagree about where the first letter starts. Overflow is
      // visible on purpose — a caption that outgrows its box spills past it.
      className="absolute resize-none overflow-visible border-0 bg-transparent p-0 outline-0"
    />
  )
}
