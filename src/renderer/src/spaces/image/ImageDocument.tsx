import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bindingOf, type CommandId } from '@shared/domain/command'
import { shortcutLabel } from '@shared/domain/shortcut'
import { assetIdFromDrag } from '@/helpers/asset-drag'
import { cn } from '@/helpers/cn'
import { CONTROL } from '@/design/styles'
import { Toolbar } from '@/design/Toolbar'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { useShortcuts } from '@/hooks/useShortcuts'
import { getBridge } from '@/services/bridge'
import { canRedo, canUndo } from '@/engines/core/history'
import { textLayer } from '@/engines/canvas/canvas-state'
import { CanvasEngine, DEFAULT_BRUSH, type BrushSettings } from '@/engines/canvas/CanvasEngine'
import { useBindingOverrides } from '@/stores/bindings'
import { addLayer } from '@/engines/canvas/commands'
import { newId } from '@/helpers/ids'
import { canvasOf, historyOf, useCanvases } from '@/stores/canvases'
import { selectionOf, useCanvasViews, viewOf } from '@/stores/canvas-views'
import { assetsById, useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { clearGuides, toggleView, zoomIn, zoomOut, zoomToActual, zoomToFit } from './canvas-view'
import { guidePort } from './guide-port'
import {
  canvasToolFor,
  cursorFor,
  DEFAULT_MODES,
  IMAGE_TOOLS,
  selectionShapeFor,
  shapeKindFor,
} from './image-tools'
import { layerPort } from './layer-port'
import { prepareEdit, type AiEdit } from './ai-actions'
import { exportPicture } from './export-picture'
import { maskFromSelection } from './mask-actions'
import { placeAsset } from './place-asset'
import { revealAssets } from './reveal-panel'
import { pixelPort } from './pixel-port'
import { ZoomBar } from './ZoomBar'

export type ImageDocumentProps = { documentId: string }

/** Which edit each command asks for. A table, so a sixth is one entry and no new branch. */
const EDIT_BY_COMMAND: Readonly<Record<string, AiEdit>> = {
  'canvas.regenerate': 'regenerate',
  'canvas.cutout': 'cutout',
  'canvas.enlarge': 'enlarge',
  'canvas.vectorize': 'vectorize',
  'canvas.extend': 'extend',
}

/**
 * The transparency checker, as one repeating gradient — no image, and no hex: a painted white
 * has to be distinguishable from nothing at all, which a plain white page never allows.
 */
const CHECKER = cn(
  'bg-[length:16px_16px]',
  'bg-[image:repeating-conic-gradient(var(--color-chassis)_0_25%,var(--color-panel)_0_50%)]',
)

export function ImageDocument({ documentId }: ImageDocumentProps) {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const engine = useRef<CanvasEngine | null>(null)

  const [tool, setTool] = useState('paint')
  // One armed mode per group, not one state per tool: a new group would otherwise mean a new
  // `useState` and a new branch in the mapping below.
  const [modes, setModes] = useState<Record<string, string>>(DEFAULT_MODES)
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH)

  const canvas = useCanvases(state => canvasOf(state, documentId))
  const view = useCanvasViews(state => viewOf(state, documentId))
  const selection = useCanvasViews(state => selectionOf(state, documentId))
  // Booleans rather than the history itself: a selector building an object on every call hands
  // React a new snapshot each render, and the loop never settles.
  const undoable = useCanvases(state => canUndo(historyOf(state, documentId)))
  const redoable = useCanvases(state => canRedo(historyOf(state, documentId)))
  const bindings = useBindingOverrides()
  const active = useDocuments(state => state.activeId === documentId)
  const byId = useAssets(assetsById)
  const [over, setOver] = useState(false)

  // What a fresh caption says. Held in a ref so the effect that builds the engine does not
  // depend on the language, which would remount it — and lose every layer's texture.
  const caption = useRef(t('imageTools.textDefault'))
  useEffect(() => {
    caption.current = t('imageTools.textDefault')
  }, [t])

  useEffect(() => {
    const element = hostRef.current
    if (!element) return

    const views = () => useCanvasViews.getState()
    // Read through the ref rather than captured: an undo can land after this engine has been
    // replaced, and it is the current one that holds the tiles.
    const pixels = pixelPort(documentId, () => engine.current)
    const created = new CanvasEngine({
      onPick: color => setBrush(current => ({ ...current, color })),
      // A stroke is one gesture, so it is one history entry — a command per dab would make
      // undo useless.
      onPixels: pixels.record,
      onPixelsDropped: pixels.drop,
      onViewport: viewport => views().setViewport(documentId, viewport),
      onSelection: selection => views().setSelection(documentId, selection),
      onHost: size => views().setHost(documentId, size),
      // Read through the ref rather than captured: rebuilding the engine on a language change
      // would take the GPU context — and the pixels in it — down with it.
      onText: at =>
        useCanvases
          .getState()
          .runCommand(documentId, addLayer(textLayer(newId(), caption.current, at))),
      guides: guidePort(documentId),
      layers: layerPort(documentId),
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
    engine.current?.setSelection(selection)
  }, [selection])

  useEffect(() => {
    engine.current?.setBrush(brush)
  }, [brush])

  const mode = modes[tool]

  useEffect(() => {
    const canvasTool = canvasToolFor(tool, mode)
    if (canvasTool) engine.current?.setTool(canvasTool)
    // The region group holds three gestures behind one tool; the bar says which is armed.
    const region = selectionShapeFor(tool, mode)
    if (region) engine.current?.setSelectionShape(region)
    // Same for the shapes group, whose six modes are one tool drawing six things.
    const shape = shapeKindFor(tool, mode)
    if (shape) engine.current?.setShape(shape)
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
        case 'canvas.export': {
          const host = engine.current
          // Swallowed here rather than left unhandled: a shortcut has nowhere to report to, and
          // the dialog it opens is what says whether anything was written.
          if (host) void exportPicture(documentId, host).catch(() => undefined)
          return
        }
        case 'canvas.deselect':
          return useCanvasViews.getState().setSelection(documentId, null)
        case 'canvas.maskFromSelection': {
          const host = engine.current
          return host ? maskFromSelection(documentId, host) : undefined
        }
        case 'canvas.regenerate':
        case 'canvas.cutout':
        case 'canvas.enlarge':
        case 'canvas.vectorize':
        case 'canvas.extend': {
          const host = engine.current
          const edit = EDIT_BY_COMMAND[command]
          const bridge = getBridge()
          if (!host || !edit || !bridge) return

          // Prepared, never submitted: the form opens filled and the user is the one who runs it.
          // The failure is swallowed here rather than left unhandled — the shortcut has nowhere
          // to report to, and the panel it opens is what says whether anything was prepared.
          void prepareEdit(documentId, edit, host, bridge.scenario).catch(() => undefined)
          return
        }
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

  /** A picture dropped on the canvas becomes a layer of its own, on top and armed. */
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setOver(false)

      const assetId = assetIdFromDrag(event)
      const asset = assetId ? byId.get(assetId) : null
      if (asset) placeAsset(documentId, asset)
    },
    [byId, documentId],
  )

  // Choosing a row arms its group: picking `Ellipse` from the shapes menu while the brush is
  // active has to hand over the ellipse, not merely remember it for later.
  const pick = useCallback((toolId: string, modeId: string) => {
    // Placing a picture arms no gesture: it is a choice, and the shelf is where one is made.
    if (modeId === 'image') return revealAssets()

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
      <div
        className={cn('relative min-w-0 flex-1 overflow-hidden', CHECKER)}
        onDragOver={event => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
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

        {/* The same overlay every droppable surface uses, rather than a border of its own: a
            difference in how two panels answer a drag reads as a bug. */}
        {over && <div className="border-accent pointer-events-none absolute inset-0 border-2" />}

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
