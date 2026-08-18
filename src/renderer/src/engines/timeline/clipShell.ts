import { CLIP_INSET, EDGE_BAR_INSET, EDGE_BAR_WIDTH, edgeGrab, FADE_BAND } from './timelineGeometry'

/**
 * The box every band draws a clip in, and the frame around it.
 *
 * Shared because a bar on the montage and a shot on the dope sheet are the same object to a
 * hand: the same inset, the same grips at the same place, the same name clipped the same way.
 * What each band puts INSIDE the box — a poster, a waveform, a fade — stays its own.
 */

/** Where a clip's box stands inside its row. The one arithmetic every band has to agree on. */
export function clipBoxOf(top: number, height: number): { top: number; height: number } {
  return { top: top + CLIP_INSET, height: height - CLIP_INSET * 2 - 1 }
}

/** What a band paints a clip with, already resolved: this module reads no palette of its own. */
export type ClipSkin = {
  ink: string
  border: string
  /** The two bars a hand grabs an edge by. */
  grip: string
  font: string
}

/** The fill alone, so a band can lay its own content over it before the frame goes on top. */
export function paintClipFill(
  context: CanvasRenderingContext2D,
  left: number,
  right: number,
  box: { top: number; height: number },
  fill: string,
): void {
  context.fillStyle = fill
  context.fillRect(left, box.top, right - left, box.height)
}

/**
 * The name, the borders and the grips — everything that sits ON a clip whatever it holds.
 *
 * The name is clipped to the box: one running past its end reads as belonging to the next clip.
 * The grips come after the borders and outside the clipping path, or a poster buries them and
 * the border alone reads as a seam between two clips rather than as an end.
 */
export function paintClipFrame(
  context: CanvasRenderingContext2D,
  left: number,
  right: number,
  box: { top: number; height: number },
  label: string,
  skin: ClipSkin,
): void {
  context.save()
  context.beginPath()
  context.rect(left, box.top, right - left, box.height)
  context.clip()
  context.font = skin.font
  context.textBaseline = 'top'
  context.fillStyle = skin.ink
  context.fillText(label, left + 6, box.top + 4)
  context.restore()

  context.fillStyle = skin.border
  context.fillRect(left, box.top, 1, box.height)
  context.fillRect(right - 1, box.top, 1, box.height)

  paintEdgeBars(context, left, right, box, skin.grip)
}

/**
 * They start BELOW the fade band, and that offset is the whole point: up there the same corner
 * opens a fade rather than a trim (`hitTest`). Skipped once the bar would be wider than the zone
 * that grabs it — `edgeGrab` gives a narrow clip's middle back to the drag.
 */
function paintEdgeBars(
  context: CanvasRenderingContext2D,
  left: number,
  right: number,
  box: { top: number; height: number },
  grip: string,
): void {
  if (edgeGrab(right - left) < EDGE_BAR_WIDTH) return

  // The band is measured from the row, `box.top` from the clip: one inset apart.
  const top = box.top + FADE_BAND - CLIP_INSET
  const height = box.height - (FADE_BAND - CLIP_INSET) - EDGE_BAR_INSET

  context.fillStyle = grip
  context.fillRect(left, top, EDGE_BAR_WIDTH, height)
  context.fillRect(right - EDGE_BAR_WIDTH, top, EDGE_BAR_WIDTH, height)
}
