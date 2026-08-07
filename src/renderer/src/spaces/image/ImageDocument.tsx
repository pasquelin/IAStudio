import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bindingOf, type CommandId } from '@shared/domain/command'
import { shortcutLabel } from '@shared/domain/shortcut'
import { cn } from '@/helpers/cn'
import { CONTROL } from '@/design/styles'
import { Toolbar } from '@/design/Toolbar'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { useShortcuts } from '@/hooks/useShortcuts'
import { canRedo, canUndo } from '@/engines/core/history'
import { CanvasEngine, DEFAULT_BRUSH, type BrushSettings } from '@/engines/canvas/CanvasEngine'
import { useBindingOverrides } from '@/stores/bindings'
import { canvasOf, historyOf, useCanvases } from '@/stores/canvases'
import { useCanvasViews, viewOf } from '@/stores/canvas-views'
import { useDocuments } from '@/stores/documents'
import { clearGuides, toggleView, zoomIn, zoomOut, zoomToActual, zoomToFit } from './canvas-view'
import { guidePort } from './guide-port'
import { canvasToolFor, cursorFor, DEFAULT_MODES, IMAGE_TOOLS } from './image-tools'
import { ZoomBar } from './ZoomBar'

export type ImageDocumentProps = { documentId: string }

/**
 * The transparency checker, as one repeating gradient — no image, and no hex: a painted white
 * has to be distinguishable from nothing at all, which a plain white page never allows.
 */
const CHECKER = cn(
  'bg-[length:16px_16px]',
  'bg-[image:repeating-conic-gradient(var(--color-chassis)_0_25%,var(--color-panel)_0_50%)]',
)

export function ImageDocument({ documentId }: ImageDocumentProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const engine = useRef<CanvasEngine | null>(null)

  const [tool, setTool] = useState('paint')
  // One armed mode per group, not one state per tool: a new group would otherwise mean a new
  // `useState` and a new branch in the mapping below.
  const [modes, setModes] = useState<Record<string, string>>(DEFAULT_MODES)
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH)

  const canvas = useCanvases(state => canvasOf(state, documentId))
  const view = useCanvasViews(state => viewOf(state, documentId))
  // Booleans rather than the history itself: a selector building an object on every call hands
  // React a new snapshot each render, and the loop never settles.
  const undoable = useCanvases(state => canUndo(historyOf(state, documentId)))
  const redoable = useCanvases(state => canRedo(historyOf(state, documentId)))
  const bindings = useBindingOverrides()
  const active = useDocuments(state => state.activeId === documentId)

  useEffect(() => {
    const element = hostRef.current
    if (!element) return

    const views = () => useCanvasViews.getState()
    const created = new CanvasEngine({
      onPick: color => setBrush(current => ({ ...current, color })),
      // A stroke is one gesture, so it is one history entry — a command per dab would make
      // undo useless.
      onStrokeEnd: () => undefined,
      onViewport: viewport => views().setViewport(documentId, viewport),
      onHost: size => views().setHost(documentId, size),
      guides: guidePort(documentId),
    })

    engine.current = created
    void created.mount(element)

    return () => {
      created.dispose()
      engine.current = null
    }
  }, [documentId])

  // The engine holds the pixels, never the stack: every state change is pushed into it.
  useEffect(() => {
    engine.current?.apply(canvas)
  }, [canvas])

  useEffect(() => {
    engine.current?.setView(view)
  }, [view])

  useEffect(() => {
    engine.current?.setBrush(brush)
  }, [brush])

  const mode = modes[tool]

  useEffect(() => {
    const canvasTool = canvasToolFor(tool, mode)
    if (canvasTool) engine.current?.setTool(canvasTool)
  }, [tool, mode])

  /**
   * What a key press means here. One `switch`, as every other space has one: the surface that is
   * listening is the one that answers, so `Meta+Equal` zooms an image here and stretches the
   * timeline there without either knowing about the other.
   */
  const run = useCallback(
    (command: CommandId) => {
      switch (command) {
        case 'canvas.zoomIn':
          return zoomIn(documentId)
        case 'canvas.zoomOut':
          return zoomOut(documentId)
        case 'canvas.zoomFit':
          return zoomToFit(documentId)
        case 'canvas.zoomActual':
          return zoomToActual(documentId)
        case 'canvas.rulers':
          return toggleView(documentId, 'rulers')
        case 'canvas.guides':
          return toggleView(documentId, 'guides')
        case 'canvas.snap':
          return toggleView(documentId, 'snap')
        case 'canvas.clearGuides':
          return clearGuides(documentId)
        case 'canvas.undo':
          return useCanvases.getState().undo(documentId)
        case 'canvas.redo':
          return useCanvases.getState().redo(documentId)
      }
    },
    [documentId],
  )

  useShortcuts({
    scope: 'canvas',
    // Dockview keeps hidden tabs mounted, and the hook swallows the keys it recognises: an
    // image left in a background tab would eat the keys the space in front is listening for.
    enabled: active,
    onCommand: run,
  })

  // Choosing a row arms its group: picking `Ellipse` from the shapes menu while the brush is
  // active has to hand over the ellipse, not merely remember it for later.
  const pick = useCallback((toolId: string, modeId: string) => {
    setModes(current => ({ ...current, [toolId]: modeId }))
    setTool(toolId)
  }, [])

  // The colour input fires continuously while the swatch is dragged; without this every frame
  // of that drag rebuilds one object per group for a list that did not change.
  const tools = useMemo(
    () => IMAGE_TOOLS.map(entry => ({ ...entry, activeMode: modes[entry.id] })),
    [modes],
  )

  // Read off the registry rather than written on the buttons: a key remapped in the settings
  // has to move on the bar with it.
  const shortcuts = useMemo(
    () => ({
      zoomIn: shortcutLabel(bindingOf('canvas.zoomIn', bindings)),
      zoomOut: shortcutLabel(bindingOf('canvas.zoomOut', bindings)),
      fit: shortcutLabel(bindingOf('canvas.zoomFit', bindings)),
      actual: shortcutLabel(bindingOf('canvas.zoomActual', bindings)),
    }),
    [bindings],
  )

  return (
    <div className="flex h-full min-h-0">
      <div className={cn('relative min-w-0 flex-1 overflow-hidden', CHECKER)}>
        {/* Pixi appends its own canvas here, and the overlay its own above it — see
            `CanvasEngine.mount`. The cursor goes on the host rather than the canvas, which Pixi
            owns and replaces on every mount. */}
        <div ref={hostRef} className="absolute inset-0" style={{ cursor: cursorFor(tool, mode) }} />

        <Toolbar
          className="absolute top-2 left-2"
          tools={tools}
          activeTool={tool}
          onTool={setTool}
          onMode={pick}
          extras={<BrushControls brush={brush} onBrush={setBrush} />}
          onUndo={() => run('canvas.undo')}
          onRedo={() => run('canvas.redo')}
          canUndo={undoable}
          canRedo={redoable}
        />

        <ZoomBar
          scale={view.viewport.scale}
          shortcuts={shortcuts}
          onZoomIn={() => run('canvas.zoomIn')}
          onZoomOut={() => run('canvas.zoomOut')}
          onFit={() => run('canvas.zoomFit')}
          onActual={() => run('canvas.zoomActual')}
        />
      </div>
    </div>
  )
}

function BrushControls({
  brush,
  onBrush,
}: {
  brush: BrushSettings
  onBrush: (next: BrushSettings) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-1">
      {/*
        A native colour input, deliberately: macOS opens the system picker, which already has
        an eyedropper, swatches and HSL fields. Same reasoning as the native `<select>` in
        `CollectionBar`.
      */}
      <input
        type="color"
        {...TIP_RIGHT(t('imageTools.color'), undefined, t('imageTools.colorHint'))}
        value={`#${brush.color.toString(16).padStart(6, '0')}`}
        onChange={event =>
          onBrush({ ...brush, color: Number.parseInt(event.target.value.slice(1), 16) })
        }
        className={cn(CONTROL, 'w-(--sc-control) cursor-pointer border-none p-0.5')}
      />
    </div>
  )
}
