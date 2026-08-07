import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/design/cn'
import { Toolbar } from '@/design/Toolbar'
import { TIP_RIGHT } from '@/design/tooltip'
import { canRedo, canUndo } from '@/engines/core/history'
import { CanvasEngine, DEFAULT_BRUSH, type BrushSettings } from '@/engines/canvas/CanvasEngine'
import { canvasOf, historyOf, useCanvases } from '@/stores/canvases'
import { canvasToolFor, cursorFor, DEFAULT_MODES, IMAGE_TOOLS } from './image-tools'

export type ImageDocumentProps = { documentId: string }

/**
 * The transparency checker, as one repeating gradient — no image, and no hex: a painted white
 * has to be distinguishable from nothing at all, which a plain white page never allows.
 */
const CHECKER = cn(
  'bg-[length:16px_16px]',
  'bg-[image:repeating-conic-gradient(var(--color-chassis)_0_25%,var(--color-base)_0_50%)]',
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
  // Booleans rather than the history itself: a selector building an object on every call hands
  // React a new snapshot each render, and the loop never settles.
  const undoable = useCanvases(state => canUndo(historyOf(state, documentId)))
  const redoable = useCanvases(state => canRedo(historyOf(state, documentId)))

  useEffect(() => {
    const element = hostRef.current
    if (!element) return

    const created = new CanvasEngine({
      onPick: color => setBrush(current => ({ ...current, color })),
      // A stroke is one gesture, so it is one history entry — a command per dab would make
      // undo useless.
      onStrokeEnd: () => undefined,
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
    engine.current?.setBrush(brush)
  }, [brush])

  const mode = modes[tool]

  useEffect(() => {
    const canvasTool = canvasToolFor(tool, mode)
    if (canvasTool) engine.current?.setTool(canvasTool)
  }, [tool, mode])

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

  return (
    <div className="flex h-full min-h-0">
      <div className={cn('relative min-w-0 flex-1', CHECKER)}>
        {/* Pixi appends its own canvas here — see `CanvasEngine.mount`. The cursor goes on the
            host rather than the canvas, which Pixi owns and replaces on every mount. */}
        <div ref={hostRef} className="absolute inset-0" style={{ cursor: cursorFor(tool, mode) }} />

        <Toolbar
          className="absolute top-2 left-2"
          tools={tools}
          activeTool={tool}
          onTool={setTool}
          onMode={pick}
          extras={<BrushControls brush={brush} onBrush={setBrush} />}
          onUndo={() => useCanvases.getState().undoCanvas(documentId)}
          onRedo={() => useCanvases.getState().redoCanvas(documentId)}
          canUndo={undoable}
          canRedo={redoable}
        />
      </div>
    </div>
  )
}

/** Same control language as `CollectionBar`, so the density setting reaches these too. */
const CONTROL = cn(
  'bg-surface text-text h-(--sc-control) rounded-(--radius-sc-md)',
  'text-[11px] outline-none focus-visible:ring-accent focus-visible:ring-1',
)

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
