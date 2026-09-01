import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bindingOf, type CommandId } from '@shared/domain/command'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { PICTURES, type Asset } from '@shared/domain/asset'
import { AssetDropTarget } from '@/components/AssetDropTarget'
import { reportFailure } from '@/services/diagnostics'
import { cn } from '@/helpers/cn'
import { PANE_TOOLBAR } from '@/components/styles'
import { Toolbar } from '@/components/Toolbar/Toolbar'
import { useLatest } from '@/hooks/useLatest'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShortcuts } from '@/hooks/useShortcuts'
import { getBridge } from '@/services/bridge'
import { registerFace } from '@/engines/canvas/canvasFonts'
import {
  canMergeDown,
  layerBelow,
  layerById,
  shapeLayer,
  textLayer,
  type ShapeKind,
} from '@/engines/canvas/canvasState'
import { CanvasEngine } from '@/engines/canvas/CanvasEngine'
import {
  DEFAULT_BRUSH,
  readsBrushSetting,
  resizedBrush,
  type BrushSettings,
} from '@/engines/canvas/brush'
import { ImageDocumentBrush } from './ImageDocumentBrush'
import { ImageDocumentText } from './ImageDocumentText'
import { RULER_SIZE } from '@/engines/canvas/CanvasOverlay'
import { useBindingOverrides } from '@/stores/bindings'
import {
  addLayer,
  cropToRect,
  flatten,
  flipImage,
  mergeDown,
  removeLayer,
  resizeCaption,
  rotateImage,
} from '@/engines/canvas/commands'
import { newId } from '@/helpers/ids'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { canvasOf, isCanvasDirty, useCanvases } from '@/stores/canvases'
import { selectionOf, useCanvasViews, canvasViewOf, cropFrameOf } from '@/stores/canvasViews'
import { useDocumentIsInFront } from '@/stores/documents'
import { clearGuides, toggleView, zoomIn, zoomOut, zoomToActual, zoomToFit } from '../../canvasView'
import { guidePort } from '../../guidePort'
import {
  AI_EDIT_TOOL,
  AI_EDIT_TOOL_ID,
  aiEditCommand,
  aiEditOf,
  armedBy,
  armingCommand,
  canvasToolFor,
  cropCommandOf,
  CROP_TOOLS,
  cursorFor,
  DEFAULT_MODES,
  IMAGE_TOOLS,
  selectionShapeFor,
  shapeKindFor,
} from '../../imageTools'
import { layerPort } from '../../layerPort'
import { prepareEdit } from '../../aiActions'
import { exportLayeredPicture, exportPicture } from '../../exportPicture'
import { maskFromSelection } from '../../maskActions'
import { placeAsset } from '../../placeAsset'
import { revealAssets } from '@/helpers/revealPanel'
import { useLivePreview } from '@/hooks/useLivePreview'
import { useDocuments } from '@/stores/documents'
import { holdCanvas } from '../../canvasHosts'
import { pixelPort } from '../../pixelPort'
import { turnPort } from '../../turnPort'
import { ZoomBar } from '../ZoomBar'

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
  const { t, i18n } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const engine = useRef<CanvasEngine | null>(null)

  // What this editor is drawing, published to every slot pointing at the asset it edits — the
  // live half of « edit the picture and the model follows », ahead of any save.
  useLivePreview(
    documentId,
    useDocuments(state => state.documents[documentId]?.sourceAssetId),
  )

  // The pointer, not the brush: a document opens on the tool that inspects rather than the one
  // that writes, so the first click on a freshly opened picture cannot leave a mark on it.
  const [tool, setTool] = useState('pointer')
  // One armed mode per group, not one state per tool: a new group would otherwise mean a new
  // `useState` and a new branch in the mapping below.
  const [modes, setModes] = useState<Record<string, string>>(DEFAULT_MODES)
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH)
  /** Whether a model edit is being flattened and uploaded — the AI group is greyed while it is. */
  const [preparing, setPreparing] = useState(false)

  const canvas = useCanvases(state => canvasOf(state, documentId))
  const view = useCanvasViews(state => canvasViewOf(state, documentId))
  // What the rulers take from the top and the left when they are on, and nothing when they are off.
  const rulerInset = view.rulers ? RULER_SIZE : 0
  const selection = useCanvasViews(state => selectionOf(state, documentId))
  const cropFrame = useCanvasViews(state => cropFrameOf(state, documentId))
  const bindings = useBindingOverrides()
  const label = useShortcutLabel()
  const active = useDocumentIsInFront(documentId)

  /** The caption being typed, if one is. Session state: nothing about it goes out with the file. */
  const [editing, setEditing] = useState<string | null>(null)

  // What the stack calls a caption while it has no words. Held in a ref so the effect that builds
  // the engine does not depend on the language, which would remount it — and lose every texture.
  const caption = useLatest(t('imageTools.textName'))
  // What the stack calls a shape the hand just drew. Held for the same reason the caption is.
  const shapeName = useLatest((kind: ShapeKind) => t(`layers.shapeName_${kind}`))

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
      onText: asked => {
        if ('layerId' in asked) return setEditing(asked.layerId)

        // Born EMPTY, and named after its kind while it has no words: a caption that opens on
        // "Your text" is a caption every user has to clear before typing their own.
        const id = newId()
        const born = { ...textLayer(id, '', asked.at, asked.box), name: caption.current }
        useCanvases.getState().runCommand(documentId, addLayer(born))
        setEditing(id)
      },
      // The box and where it now starts, in one entry: a north grip moves both, and two commands
      // would be two steps of undo for one pull.
      onTextBox: (layerId, box, at) =>
        useCanvases.getState().runCommand(documentId, resizeCaption(layerId, box, at)),
      onShape: (at, drawn) =>
        useCanvases
          .getState()
          .runCommand(
            documentId,
            addLayer(shapeLayer(newId(), shapeName.current(drawn.shape), at, drawn)),
          ),
      onCrop: rect => useCanvases.getState().runCommand(documentId, cropToRect(rect)),
      onCropFrame: framed => views().setCropFrame(documentId, framed),
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
  }, [documentId, caption, shapeName])

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

  // The layer steps aside while the field draws it, so the words are drawn once and by one thing.
  useEffect(() => {
    engine.current?.setEditingText(editing)
  }, [editing])

  /** The caption being typed, read back from the stack: the field edits the layer, not a copy. */
  const typed = editing ? layerById(canvas, editing) : null
  const typing = typed?.kind === 'text' ? typed : null

  /**
   * Ends a typing session. A caption nobody typed into is REMOVED rather than left standing: an
   * empty text layer draws nothing at all, and a stack full of them is what a mis-click leaves.
   */
  const endTyping = useCallback(
    (closed: string): void => {
      // Read from the store rather than from `typing`: the last keystroke is written
      // asynchronously, and a captured layer is one render old exactly when it matters.
      const layer = layerById(canvasOf(useCanvases.getState(), documentId), closed)
      if (layer?.kind === 'text' && layer.text.trim() === '') {
        useCanvases.getState().runCommand(documentId, removeLayer(closed))
      }
      // Only while it is still the caption on screen. A click elsewhere on the canvas opens the
      // NEXT one before this blur is delivered, and closing then shut the editor that click had
      // just opened — and deleted the empty caption it had just made.
      setEditing(current => (current === closed ? null : current))
    },
    [documentId],
  )

  const mode = modes[tool]
  // Read by the memoised `run` below, which must not be rebuilt every time the armed tool
  // changes — the shortcut listener it feeds would be torn down and hung again with it.
  const armed = useLatest(canvasToolFor(tool, mode) ?? 'move')

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
        case 'canvas.export':
        case 'canvas.exportLayered': {
          const host = engine.current
          // Reported rather than swallowed: a dismissed dialog and a refused write look exactly
          // alike from here, and only one of the two is worth knowing about.
          if (host) {
            const written =
              command === 'canvas.export'
                ? exportPicture(documentId, host)
                : exportLayeredPicture(documentId, host)
            void written.catch(error => reportFailure('image.export', documentId, error))
          }
          return
        }
        case 'canvas.brushLarger':
        case 'canvas.brushSmaller': {
          // With the pointer or the crop armed, the settings are not on screen: the brackets
          // moved a number nobody could see, and the surprise arrived at the next stroke.
          if (!readsBrushSetting(armed.current, 'size')) return
          const way = command === 'canvas.brushLarger' ? 'larger' : 'smaller'
          return setBrush(current => resizedBrush(current, way))
        }
        case 'canvas.selectAll': {
          const stack = canvasOf(useCanvases.getState(), documentId)
          return useCanvasViews.getState().setSelection(documentId, {
            kind: 'rect',
            rect: { x: 0, y: 0, width: stack.width, height: stack.height },
          })
        }
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
          const edit = aiEditOf(command)
          const bridge = getBridge()
          if (!host || !edit || !bridge) return

          // Prepared, never submitted: the form opens filled and the user is the one who runs it.
          // Reported rather than swallowed — the panel opening is what says something WAS prepared,
          // and nothing at all was what a refusal looked like.
          setPreparing(true)
          void prepareEdit(documentId, edit, host, bridge.provider)
            .catch(error => reportFailure('canvas.edit', documentId, error))
            .finally(() => setPreparing(false))
          return
        }
        case 'canvas.mergeDown': {
          const host = engine.current
          // This handler is memoised: a captured stack goes stale the moment the selection moves.
          const stack = canvasOf(useCanvases.getState(), documentId)
          const active = stack.activeLayerId
          // The very test the menu greys its row with — read from both sides, like
          // `canRemoveLayer`, so a row is never offered for a gesture this will decline.
          if (!host || !active || !canMergeDown(stack)) return
          const below = layerBelow(stack.layers, active)
          if (!below) return
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
        case 'canvas.rotateCcw':
          // The port turns the pixels, from inside the command — so an undo unturns them. Done
          // here instead, ⌘Z gave back a portrait frame over landscape textures.
          return useCanvases
            .getState()
            .runCommand(
              documentId,
              rotateImage(command === 'canvas.rotateCw', turnPort(documentId)),
            )
        case 'canvas.undo':
          return useCanvases.getState().undo(documentId)
        case 'canvas.redo':
          return useCanvases.getState().redo(documentId)
      }
    },
    [armed, documentId, pick, t],
  )

  useShortcuts({
    scope: 'canvas',
    // Dockview keeps hidden tabs mounted, and the hook swallows the keys it recognises: an
    // image left in a background tab would eat the keys the space in front is listening for.
    enabled: active,
    // What the Layers panel addresses when it sends one — its rows edit the document it shows,
    // never whichever one is in front.
    documentId,
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
    const keyFor = (command: CommandId | null): string | undefined =>
      command ? label(bindingOf(command, bindings)) || undefined : undefined

    const keyOf = (toolId: string, modeId?: string): string | undefined =>
      keyFor(armingCommand(toolId, modeId))

    return [
      ...IMAGE_TOOLS.map(entry => ({
        ...entry,
        activeMode: modes[entry.id],
        shortcut: keyOf(entry.id),
        modes: entry.modes?.map(item => ({ ...item, shortcut: keyOf(entry.id, item.id) })),
      })),
      // No `activeMode`, and that is what makes it a menu of actions rather than a choice of
      // tool: none of its rows can be armed, so the click opens what hovering would have.
      //
      // Greyed while one is being prepared: flattening the document and uploading it takes as
      // long as the network does, and until the generator opened there was nothing at all on
      // screen to say the click had been heard.
      { ...AI_EDIT_TOOL, disabled: preparing },
      ...CROP_TOOLS.map(entry => ({
        ...entry,
        disabled: !cropFrame,
        shortcut: keyFor(entry.command),
      })),
    ]
  }, [modes, bindings, label, cropFrame, preparing])

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

        {typing && (
          <ImageDocumentText
            documentId={documentId}
            layer={typing}
            viewport={view.viewport}
            label={t('imageTools.textEditing')}
            onDone={endTyping}
          />
        )}

        {/* Inside the rulers rather than over them: the toolbar covered the first twenty pixels
            of both graduations — the corner one reads a position from. A margin, so the gap the
            class already sets is kept, and the engine's own constant stays the only truth about
            how thick a ruler is. */}
        <Toolbar
          className={PANE_TOOLBAR}
          style={{ marginTop: rulerInset, marginLeft: rulerInset }}
          tools={tools}
          activeTool={tool}
          // Two of them act instead of arming: answering a crop frame is not a choice of tool.
          onTool={toolId => {
            const command = cropCommandOf(toolId)
            return command ? run(command) : setTool(toolId)
          }}
          onMode={(toolId, modeId) => {
            if (toolId !== AI_EDIT_TOOL_ID) return pick(toolId, modeId)
            const command = aiEditCommand(modeId)
            if (command) run(command)
          }}
          extras={
            <ImageDocumentBrush
              armed={canvasToolFor(tool, mode)}
              cell={canvas.pixelCell}
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
