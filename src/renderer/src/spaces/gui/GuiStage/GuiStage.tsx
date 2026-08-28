import { useEffect, useMemo, useRef, type PointerEvent, type WheelEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, versionedUrl } from '@shared/domain/asset'
import type { UiBoxes } from '@shared/domain/ui'
import { createCanvasUiMeasure } from '@game/host/canvasUiMeasure'
import { createDomUiRenderer } from '@game/host/domUiRenderer'
import { createUiRuler } from '@game/host/uiRuler'
import { NO_UI_VALUES, type UiRenderPort } from '@game/ports/uiRenderPort'
import { layoutOf } from '@game/ui/uiLayout'
import { flattened } from '@game/ui/uiTree'
import { clampCanvasScale, toDocument, zoomCanvasAt } from '@/engines/canvas/viewport'
import { pickFrom } from '@/helpers/selection'
import { assetVersionOf } from '@/stores/assets'
import { guiOf, selectInGui, useGuis } from '@/stores/gui'
import { guiHostOf, guiViewportOf, useGuiViews } from '@/stores/guiViews'
import { fitGuiToPanel } from '../guiView'
import { GuiSelectionFrame } from './GuiSelectionFrame'

/**
 * How much wheel travel doubles the zoom. The image editor's own number (`CanvasEngine.onWheel`):
 * a pinch has to move both canvases of this studio by the same amount.
 */
const WHEEL_PER_DOUBLING = 250

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
  //
  // 🛑 The picture sizes are `null`, so an `image` sized `auto` lays out at nothing — nothing in
  // the window publishes a decoded picture's natural size yet, and a guessed box would shove its
  // neighbours twice. The inspector lot is where that source arrives.
  const measure = useMemo(
    () => createCanvasUiMeasure(createUiRuler(window.document), () => null),
    [],
  )
  // On `root` and `design` rather than on the document: a binding edited tomorrow would
  // otherwise re-solve the whole layout for nothing.
  const boxes: UiBoxes = useMemo(
    () => layoutOf(ui.root, ui.design, measure),
    [ui.root, ui.design, measure],
  )

  useEffect(() => {
    const observed = host.current
    if (!observed) return

    const observer = new ResizeObserver(() => {
      const first = guiHostOf(useGuiViews.getState(), documentId).width === 0
      useGuiViews.getState().setHost(documentId, {
        width: observed.clientWidth,
        height: observed.clientHeight,
      })
      // Framed the first time the panel has a size: a 1920-wide page opened at scale 1 shows its
      // top-left corner and nothing else, and the image editor frames on its first measure too.
      if (first) fitGuiToPanel(documentId)
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
    renderer.current?.draw([
      { ui: documentId, document: ui, boxes, values: NO_UI_VALUES, order: 0 },
    ])
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
    if (!hit) return selectInGui(documentId, [])

    // Through `pickFrom`, so ⇧ and ⌘ mean here exactly what they mean in the outliner — the
    // order it extends over is the paint order, which is what the eye reads on the page.
    const picked = pickFrom(
      flattened(ui.root).map(element => element.id),
      selectedIds.at(-1),
      hit.element,
      event,
    )
    selectInGui(documentId, picked.ids, picked.mode)
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>): void => {
    const frame = host.current?.getBoundingClientRect()
    if (!frame) return

    // 🛑 Off the STORE, not off the render closure: wheel events outrun React's commits, so two
    // in one frame would both start from the same stale viewport and the second would drop the
    // first. `guiView.reframe` reads the store for the same reason.
    const views = useGuiViews.getState()
    const held = guiViewportOf(views, documentId)

    if (event.ctrlKey || event.metaKey) {
      const anchor = { x: event.clientX - frame.left, y: event.clientY - frame.top }
      const scale = clampCanvasScale(held.scale * Math.exp(-event.deltaY / WHEEL_PER_DOUBLING))
      views.setViewport(documentId, zoomCanvasAt(held, scale, anchor))
      return
    }

    views.setViewport(documentId, {
      ...held,
      x: held.x - event.deltaX,
      y: held.y - event.deltaY,
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
