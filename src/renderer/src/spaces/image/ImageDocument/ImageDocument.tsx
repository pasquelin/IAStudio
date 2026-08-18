import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bindingOf, type CommandId } from '@shared/domain/command'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { PICTURES, type Asset } from '@shared/domain/asset'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { reportFailure } from '@/services/diagnostics'
import { cn } from '@/helpers/cn'
import { PANE_TOOLBAR } from '@/design/styles'
import { Toolbar } from '@/design/Toolbar/Toolbar'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShortcuts } from '@/hooks/useShortcuts'
import { getBridge } from '@/services/bridge'
import { registerFace } from '@/engines/canvas/canvasFonts'
import { layerBelow, textLayer } from '@/engines/canvas/canvasState'
import { CanvasEngine } from '@/engines/canvas/CanvasEngine'
import { DEFAULT_BRUSH, resizedBrush, type BrushSettings } from '@/engines/canvas/brush'
import { ImageDocumentBrush } from './ImageDocumentBrush'
import { RULER_SIZE } from '@/engines/canvas/CanvasOverlay'
import { useBindingOverrides } from '@/stores/bindings'
import {
  addLayer,
  cropToRect,
  flatten,
  flipImage,
  mergeDown,
  rotateImage,
} from '@/engines/canvas/commands'
import { newId } from '@/helpers/ids'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { canvasOf, isCanvasDirty, useCanvases } from '@/stores/canvases'
import { selectionOf, useCanvasViews, canvasViewOf } from '@/stores/canvasViews'
import { useDocuments } from '@/stores/documents'
import { clearGuides, toggleView, zoomIn, zoomOut, zoomToActual, zoomToFit } from '../canvasView'
import { guidePort } from '../guidePort'
import {
  armedBy,
  armingCommand,
  canvasToolFor,
  cursorFor,
  DEFAULT_MODES,
  IMAGE_TOOLS,
  selectionShapeFor,
  shapeKindFor,
} from '../imageTools'
import { layerPort } from '../layerPort'
import { prepareEdit, type AiEdit } from '../aiActions'
import { exportPicture } from '../exportPicture'
import { maskFromSelection } from '../maskActions'
import { placeAsset } from '../placeAsset'
import { revealAssets } from '@/helpers/revealPanel'
import { holdCanvas } from '../canvasHosts'
import { pixelPort } from '../pixelPort'
import { ZoomBar } from '../ZoomBar'

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
  const { t, i18n } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const engine = useRef<CanvasEngine | null>(null)

  // The pointer, not the brush: a document opens on the tool that inspects rather than the one
  // that writes, so the first click on a freshly opened picture cannot leave a mark on it.
  const [tool, setTool] = useState('pointer')
  // One armed mode per group, not one state per tool: a new group would otherwise mean a new
  // `useState` and a new branch in the mapping below.
  const [modes, setModes] = useState<Record<string, string>>(DEFAULT_MODES)
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH)

  const canvas = useCanvases(state => canvasOf(state, documentId))
  const view = useCanvasViews(state => canvasViewOf(state, documentId))
  // What the rulers take from the top and the left when they are on, and nothing when they are off.
  const rulerInset = view.rulers ? RULER_SIZE : 0
  const selection = useCanvasViews(state => selectionOf(state, documentId))
  const bindings = useBindingOverrides()
  const label = useShortcutLabel()
  const active = useDocuments(state => state.activeId === documentId)

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
      onCrop: rect => useCanvases.getState().runCommand(documentId, cropToRect(rect)),
      guides: guidePort(documentId),
      layers: layerPort(documentId),
      // Named here rather than defaulted inside the engine: jsdom has no `FontFace`, so
      // every test hands its own, and a default would be a path nothing ever walks.
      addFace: registerFace,
    })

    engine.current = created
    // Read through the ref rather than captured, for the reason `pixelPort` gives: a save can
    // land after this engine has been replaced, and the current one holds the textures.
    const release = holdCanvas(documentId, () => engine.current)
    void created.mount(element)

    return () => {
      release()
      created.dispose()
      engine.current = null
    }
  }, [documentId])

  // After the engine is registered, never before: the pixels are handed to it, and it has to be
  // reachable.
  useDocumentTitle(
    documentId,
    useCanvases(state => isCanvasDirty(state, documentId)),
  )

  useRestoredDocument(documentId)

  // The engine holds the pixels, never the stack: every state change is pushed into it.
  useEffect(() => {
    engine.current?.apply(canvas)
  }, [canvas])

  useEffect(() => {
    engine.current?.setView(view)
  }, [view])

  useEffect(() => {
    engine.current?.setLanguage(i18n.language)
  }, [i18n.language])

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
   * Choosing a row arms its group: picking `Ellipse` from the shapes menu while the brush is
   * active has to hand over the ellipse, not merely remember it for later.
   */
  const pick = useCallback((toolId: string, modeId?: string) => {
    // Placing a picture arms no gesture: it is a choice, and the shelf is where one is made.
    if (modeId === 'image') return revealAssets()

    if (modeId) setModes(current => ({ ...current, [toolId]: modeId }))
    setTool(toolId)
  }, [])

  /**
   * What a key press means here. One `switch`, as every other space has one: the surface that is
   * listening is the one that answers, so `Meta+Equal` zooms an image here and stretches the
   * timeline there without either knowing about the other.
   */
  const run = useCallback(
    (command: CommandId) => {
      // Twenty commands that all do the same thing, answered by the table rather than by twenty
      // cases: a tool added to the bar is one row there, and never a branch forgotten here.
      const arming = armedBy(command)
      if (arming) return pick(arming.tool, arming.mode)

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
          // Reported rather than swallowed: a dismissed dialog and a refused write look exactly
          // alike from here, and only one of the two is worth knowing about.
          if (host) {
            void exportPicture(documentId, host).catch(error =>
              reportFailure('image.export', documentId, error),
            )
          }
          return
        }
        case 'canvas.brushLarger':
          return setBrush(current => resizedBrush(current, 'larger'))
        case 'canvas.brushSmaller':
          return setBrush(current => resizedBrush(current, 'smaller'))
        case 'canvas.deselect':
          return useCanvasViews.getState().setSelection(documentId, null)
        // Both no-ops without a frame on screen, which is what makes ⏎ and ⎋ safe to bind here:
        // the engine answers, and only the document in front is listening.
        case 'canvas.cropApply':
          return engine.current?.applyCrop()
        case 'canvas.cropCancel':
          return engine.current?.dropCrop()
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
          // Reported rather than swallowed — the panel opening is what says something WAS prepared,
          // and nothing at all was what a refusal looked like.
          void prepareEdit(documentId, edit, host, bridge.scenario).catch(error =>
            reportFailure('canvas.edit', documentId, error),
          )
          return
        }
        case 'canvas.mergeDown': {
          const host = engine.current
          // This handler is memoised: a captured stack goes stale the moment the selection moves.
          const stack = canvasOf(useCanvases.getState(), documentId)
          const active = stack.activeLayerId
          const below = active ? layerBelow(stack.layers, active) : null
          // Nothing under it at its own level: no merge to offer, and nothing to say about it.
          if (!host || !active || !below) return
          // Composed before the command, which is the last moment the upper layer's pixels exist.
          host.mergeInto(below.id, active)
          return useCanvases.getState().runCommand(documentId, mergeDown(active))
        }
        case 'canvas.flatten': {
          const host = engine.current
          if (!host) return
          const id = newId()
          // Same order, and for the same reason: once the stack is one layer, the picture it was
          // made of no longer exists to be composed.
          host.flattenInto(id)
          return useCanvases
            .getState()
            .runCommand(documentId, flatten(id, t('commands.canvasFlatten.layerName')))
        }
        case 'canvas.flipHorizontal':
          return useCanvases.getState().runCommand(documentId, flipImage('horizontal'))
        case 'canvas.flipVertical':
          return useCanvases.getState().runCommand(documentId, flipImage('vertical'))
        case 'canvas.rotateCw':
          return useCanvases.getState().runCommand(documentId, rotateImage(true))
        case 'canvas.rotateCcw':
          return useCanvases.getState().runCommand(documentId, rotateImage(false))
        case 'canvas.undo':
          return useCanvases.getState().undo(documentId)
        case 'canvas.redo':
          return useCanvases.getState().redo(documentId)
      }
    },
    [documentId, pick, t],
  )

  useShortcuts({
    scope: 'canvas',
    // Dockview keeps hidden tabs mounted, and the hook swallows the keys it recognises: an
    // image left in a background tab would eat the keys the space in front is listening for.
    enabled: active,
    onCommand: run,
  })

  /** A picture dropped on the canvas becomes a layer of its own, on top and armed. */
  const onDrop = (asset: Asset): void => placeAsset(documentId, asset)

  /**
   * The colour input fires continuously while the swatch is dragged; without this every frame of
   * that drag rebuilds one object per group for a list that did not change.
   *
   * Every key shown is read off the registry, never written on the button: a key remapped in the
   * settings has to move on the bar with it, exactly as `ZoomBar`'s already do.
   */
  const tools = useMemo(() => {
    // Absent rather than empty when a gesture has no key: a button says nothing instead of
    // wearing a blank where a shortcut is meant to be.
    const keyOf = (toolId: string, modeId?: string): string | undefined => {
      const command = armingCommand(toolId, modeId)
      return command ? label(bindingOf(command, bindings)) || undefined : undefined
    }

    return IMAGE_TOOLS.map(entry => ({
      ...entry,
      activeMode: modes[entry.id],
      shortcut: keyOf(entry.id),
      modes: entry.modes?.map(item => ({ ...item, shortcut: keyOf(entry.id, item.id) })),
    }))
  }, [modes, bindings, label])

  // Read off the registry rather than written on the buttons: a key remapped in the settings
  // has to move on the bar with it.
  const shortcuts = useMemo(
    () => ({
      zoomIn: label(bindingOf('canvas.zoomIn', bindings)),
      zoomOut: label(bindingOf('canvas.zoomOut', bindings)),
      fit: label(bindingOf('canvas.zoomFit', bindings)),
      actual: label(bindingOf('canvas.zoomActual', bindings)),
    }),
    [bindings, label],
  )

  const brushKeys = useMemo(
    () => ({
      smaller: label(bindingOf('canvas.brushSmaller', bindings)),
      larger: label(bindingOf('canvas.brushLarger', bindings)),
    }),
    [bindings, label],
  )

  return (
    <div className="flex h-full min-h-0">
      <AssetDropTarget
        accepts={PICTURES}
        onDrop={onDrop}
        // No frame: this surface fills the centre, so outlining it says nothing the user cannot
        // already see — the same call `DocumentArea` makes for the middle behind it.
        outlined={false}
        className={cn('relative min-w-0 flex-1 overflow-hidden', CHECKER)}
      >
        {/* Pixi appends its own canvas here, and the overlay its own above it — see
            `CanvasEngine.mount`. The cursor goes on the host rather than the canvas, which Pixi
            owns and replaces on every mount. */}
        <div ref={hostRef} className="absolute inset-0" style={{ cursor: cursorFor(tool, mode) }} />

        {/* Inside the rulers rather than over them: the toolbar covered the first twenty pixels
            of both graduations — the corner one reads a position from. A margin, so the gap the
            class already sets is kept, and the engine's own constant stays the only truth about
            how thick a ruler is. */}
        <Toolbar
          className={PANE_TOOLBAR}
          style={{ marginTop: rulerInset, marginLeft: rulerInset }}
          tools={tools}
          activeTool={tool}
          onTool={setTool}
          onMode={pick}
          extras={
            <ImageDocumentBrush
              armed={canvasToolFor(tool, mode)}
              brush={brush}
              onBrush={setBrush}
              shortcuts={brushKeys}
            />
          }
        />

        <ZoomBar
          scale={view.viewport.scale}
          shortcuts={shortcuts}
          onZoomIn={() => run('canvas.zoomIn')}
          onZoomOut={() => run('canvas.zoomOut')}
          onFit={() => run('canvas.zoomFit')}
          onActual={() => run('canvas.zoomActual')}
        />
      </AssetDropTarget>
    </div>
  )
}
