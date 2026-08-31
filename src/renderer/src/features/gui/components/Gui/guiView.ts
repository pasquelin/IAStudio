import {
  centerOn,
  fitTo,
  nextZoom,
  previousZoom,
  zoomCanvasAt,
  type Viewport,
} from '@/engines/canvas/viewport'
import type { Size } from '@/engines/core/geometry'
import { setUiDesign } from '@/engines/gui/guiCommands'
import { guiOf, useGuis } from '@/stores/gui'
import { guiHostOf, guiViewportOf, useGuiViews } from '@/stores/guiViews'

/**
 * Looking around an interface, from wherever the gesture comes — a toolbar button, a key, a
 * menu. Written once, as the image editor's own is: a zoom step that centres differently
 * depending on which button was pressed is a defect nobody thinks to look for.
 */

/** How large the panel is, or nothing before it has been measured — where a zoom has no answer. */
function panel(documentId: string): Size | null {
  const host = guiHostOf(useGuiViews.getState(), documentId)
  return host.width === 0 || host.height === 0 ? null : host
}

function reframe(documentId: string, change: (viewport: Viewport) => Viewport): void {
  const views = useGuiViews.getState()
  views.setViewport(documentId, change(guiViewportOf(views, documentId)))
}

/** Around the middle of the panel: a key press has no pointer to zoom towards. */
function step(documentId: string, pick: (scale: number) => number): void {
  const host = panel(documentId)
  if (!host) return

  const anchor = { x: host.width / 2, y: host.height / 2 }
  reframe(documentId, viewport => zoomCanvasAt(viewport, pick(viewport.scale), anchor))
}

export function zoomGuiIn(documentId: string): void {
  step(documentId, nextZoom)
}

export function zoomGuiOut(documentId: string): void {
  step(documentId, previousZoom)
}

export function fitGuiToPanel(documentId: string): void {
  // No inset: that argument is what a RULER band eats off the top and left, and this editor has
  // none — passing one pushed the page off centre while ⌘1 beside it centred properly.
  frame(documentId, (design, host) => fitTo(design, host))
}

/** One design pixel per screen pixel, centred — what ⌘1 means in every editor. */
export function guiToActualSize(documentId: string): void {
  frame(documentId, (design, host) => centerOn(design, host, 1))
}

function frame(documentId: string, place: (design: Size, host: Size) => Viewport): void {
  const host = panel(documentId)
  if (!host) return

  reframe(documentId, () => place(guiOf(useGuis.getState(), documentId).document.design, host))
}

/**
 * The canvas the document is composed for. Through the history like every other edit, then
 * reframed: the page just changed shape, and leaving the old pan would push it off screen.
 */
export function setGuiResolution(documentId: string, design: Size): void {
  useGuis.getState().runCommand(documentId, setUiDesign(design))
  fitGuiToPanel(documentId)
}
