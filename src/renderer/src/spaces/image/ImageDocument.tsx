import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/design/cn'
import { Toolbar } from '@/design/Toolbar'
import { canRedo, canUndo } from '@/engines/core/history'
import { CanvasEngine, DEFAULT_BRUSH, type BrushSettings } from '@/engines/canvas/CanvasEngine'
import { canvasOf, historyOf, useCanvases } from '@/stores/canvases'
import { IMAGE_TOOLS, toolById } from './image-tools'
import { LayersPanel } from './LayersPanel'

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
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engine = useRef<CanvasEngine | null>(null)

  const [tool, setTool] = useState('brush')
  const [eraserMode, setEraserMode] = useState('point')
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH)

  const canvas = useCanvases(state => canvasOf(state, documentId))
  // Booleans rather than the history itself: a selector building an object on every call hands
  // React a new snapshot each render, and the loop never settles.
  const undoable = useCanvases(state => canUndo(historyOf(state, documentId)))
  const redoable = useCanvases(state => canRedo(historyOf(state, documentId)))

  useEffect(() => {
    const element = canvasRef.current
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

  useEffect(() => {
    const selected = toolById(tool)
    if (selected) engine.current?.setTool(selected.tool)
  }, [tool])

  const pick = useCallback((_toolId: string, modeId: string) => setEraserMode(modeId), [])

  const tools = IMAGE_TOOLS.map(entry => ({
    ...entry,
    activeMode: entry.id === 'eraser' ? eraserMode : undefined,
  }))

  return (
    <div className="flex h-full min-h-0">
      <div className={cn('relative min-w-0 flex-1', CHECKER)}>
        <canvas ref={canvasRef} className="block size-full" />

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

      <aside
        className="border-border bg-base w-52 shrink-0 border-l"
        aria-label={t('layers.title')}
      >
        <LayersPanel documentId={documentId} />
      </aside>
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
        aria-label={t('imageTools.color')}
        value={`#${brush.color.toString(16).padStart(6, '0')}`}
        onChange={event =>
          onBrush({ ...brush, color: Number.parseInt(event.target.value.slice(1), 16) })
        }
        className={cn(CONTROL, 'w-(--sc-control) cursor-pointer border-none p-0.5')}
      />
      <input
        type="range"
        min={1}
        max={200}
        value={brush.size}
        aria-label={t('imageTools.size')}
        onChange={event => onBrush({ ...brush, size: Number(event.target.value) })}
        className="h-(--sc-control) w-(--sc-control) cursor-pointer [writing-mode:vertical-lr]"
      />
    </div>
  )
}
