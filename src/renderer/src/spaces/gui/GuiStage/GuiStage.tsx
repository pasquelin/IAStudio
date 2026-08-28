import { useEffect, useMemo, useRef, type PointerEvent, type WheelEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, versionedUrl } from '@shared/domain/asset'
import type { UiBoxes } from '@shared/domain/ui'
import { createCanvasUiMeasure } from '@game/host/canvasUiMeasure'
import { createDomUiRenderer } from '@game/host/domUiRenderer'
import type { UiRenderPort } from '@game/ports/uiRenderPort'
import { layoutOf } from '@game/ui/uiLayout'
import { clampCanvasScale, toDocument, zoomCanvasAt } from '@/engines/canvas/viewport'
import { assetVersionOf } from '@/stores/assets'
import { guiOf, selectInGui, useGuis } from '@/stores/gui'
import { guiViewportOf, useGuiViews } from '@/stores/guiViews'
import { createUiRuler } from '../uiRuler'
import { GuiSelectionFrame } from './GuiSelectionFrame'

/** How much wheel travel doubles the zoom. A trackpad pinch arrives here as a ctrl-wheel. */
const WHEEL_PER_DOUBLING = 500

/**
 * The page an interface is drawn on, and the one place a pointer meets it.
 *
 * React mounts `domUiRenderer` and pushes frames at it; the renderer knows nothing of React —
 * invariant 4. What is on screen answers no gesture either: the overlay is pointer-transparent
 * and every hit goes through `pick`, which reads the boxes the solver computed. That is what
 * lets a world-space renderer answer the same question later, from the same code.
 */
export function GuiStage({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const renderer = useRef<UiRenderPort | null>(null)

  const ui = useGuis(state => guiOf(state, documentId).document)
  const selectedIds = useGuis(state => guiOf(state, documentId).selectedIds)
  const viewport = useGuiViews(state => guiViewportOf(state, documentId))

  // One ruler per stage: a 2D context is cheap to hold and dear to make on every layout.
  const measure = useMemo(() => createCanvasUiMeasure(createUiRuler(), () => null), [])
  const boxes: UiBoxes = useMemo(() => layoutOf(ui.root, ui.design, measure), [ui, measure])

  useEffect(() => {
    const observed = host.current
    if (!observed) return

    const observer = new ResizeObserver(() => {
      useGuiViews.getState().setHost(documentId, {
        width: observed.clientWidth,
        height: observed.clientHeight,
      })
    })
    observer.observe(observed)
    return () => observer.disconnect()
  }, [documentId])

  useEffect(() => {
    const into = page.current
    if (!into) return

    const made = createDomUiRenderer({
      host: into,
      // Versioned, or a picture replaced under the same id keeps the bytes the window
      // decoded the first time — the defect `no-unversioned-asset-url.test.ts` watches.
      assets: {
        urlOf: ref =>
          ref.kind === 'asset' ? versionedUrl(assetUrl(ref.id), assetVersionOf(ref.id)) : null,
      },
      picking: { skipLocked: true },
    })
    renderer.current = made

    return () => {
      renderer.current = null
      made.dispose()
    }
  }, [])

  useEffect(() => {
    renderer.current?.resize(ui.design)
    renderer.current?.draw([{ ui: documentId, document: ui, boxes, values: new Map(), order: 0 }])
  }, [documentId, ui, boxes])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    // The middle button pans, as it does next door. A drag with the left one is what the
    // direct-manipulation lot takes over, and claiming it here would take it back from it.
    if (event.button === 1) return

    const frame = host.current?.getBoundingClientRect()
    if (!frame) return

    const point = toDocument(viewport, {
      x: event.clientX - frame.left,
      y: event.clientY - frame.top,
    })
    const hit = renderer.current?.pick(point) ?? null
    const mode = event.metaKey || event.ctrlKey ? 'toggle' : 'replace'
    selectInGui(documentId, hit ? [hit.element] : [], mode)
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>): void => {
    const frame = host.current?.getBoundingClientRect()
    if (!frame) return

    const views = useGuiViews.getState()
    if (event.ctrlKey || event.metaKey) {
      const anchor = { x: event.clientX - frame.left, y: event.clientY - frame.top }
      const scale = clampCanvasScale(viewport.scale * Math.exp(-event.deltaY / WHEEL_PER_DOUBLING))
      views.setViewport(documentId, zoomCanvasAt(viewport, scale, anchor))
      return
    }

    views.setViewport(documentId, {
      ...viewport,
      x: viewport.x - event.deltaX,
      y: viewport.y - event.deltaY,
    })
  }

  return (
    <div
      ref={host}
      data-sc="section:gui.stage"
      role="presentation"
      aria-label={t('gui.stage')}
      className="bg-chassis relative min-h-0 flex-1 overflow-hidden"
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      {/* The page, moved and scaled as one: the renderer poses design pixels inside it and
          knows nothing of the zoom. */}
      <div
        ref={page}
        data-sc="section:gui.page"
        className="bg-surface absolute origin-top-left"
        style={{
          width: ui.design.width,
          height: ui.design.height,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
        }}
      />
      <GuiSelectionFrame boxes={boxes} selectedIds={selectedIds} viewport={viewport} />
    </div>
  )
}
