import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MEMORY_STATES, type MemoryState } from '@shared/domain/assistantMemory'
import { memoryEdgesOf } from '@shared/domain/memoryGraph'
import { memoryLayoutOf, type MemoryLayout, type PlacedNode } from '@/engines/memory/memoryLayout'
import { WINDOW_CAPTION } from '@/design/windowStyles'
import { useRepaintOnResize } from '@/hooks/useRepaintOnResize'
import { useToken } from '@/hooks/useToken'
import { useAssistantMemory } from '@/stores/assistantMemory'
import { MemoryGraphReading } from './MemoryGraphReading'

/**
 * The whole of what the assistant knows about one project, as points and lines.
 *
 * 🛑 A sub-section rather than a strip under the list: a graph is READ, not scanned past, and the
 * memory section already scrolls. What sizes a dot is how many memories tie to it — the thing a
 * list cannot show at all, which is the only reason this view earns its place.
 *
 * One colour, not one per sort: `accent` says « what you act on » in this studio, and eight new
 * hues are a design decision of their own rather than something a panel invents for itself.
 *
 * The section's own description is drawn by `SettingsWindow` from `descriptionKey`. Repeating it
 * here put the same sentence on screen twice.
 */

/** Archived memories are drawn too: what was set aside still says what it stood beside. */
const SHOWN: readonly MemoryState[] = MEMORY_STATES.filter(one => one !== 'dropped')

const STAGE_HEIGHT = 360

/** Before the first measure, and under jsdom, which reports every box at zero. */
const FALLBACK_WIDTH = 560

const DOT = 3.2
const DOT_PER_LINK = 1.15
const DOT_CAP = 9

export function MemoryGraph() {
  const { t } = useTranslation()
  const memories = useAssistantMemory(state => state.memories)
  const scope = useAssistantMemory(state => state.scope)
  const look = useAssistantMemory(state => state.look)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [hovered, setHovered] = useState<PlacedNode | null>(null)
  // 🛑 The width is MEASURED, never stated: a canvas of a fixed 640 in a column narrower than
  // that put a horizontal scrollbar under the graph, and the panel scrolled sideways.
  const [width, setWidth] = useState(FALLBACK_WIDTH)

  // Its own listing: someone opening this section straight from the navigation never passed
  // through the list, and the store would hold whatever the last question left in it.
  useEffect(() => {
    void look(scope, { states: SHOWN })
  }, [look, scope])

  const ink = useToken('--color-accent-ink')
  const line = useToken('--color-muted')

  const layout = useMemo(
    () =>
      memoryLayoutOf(
        memories.map(one => ({ id: one.id, type: one.type, label: one.summary })),
        memoryEdgesOf(memories).map(edge => ({ from: edge.from, to: edge.to })),
        { width, height: STAGE_HEIGHT },
      ),
    [memories, width],
  )

  const measure = useCallback(() => {
    const box = canvas.current?.getBoundingClientRect()
    if (box && box.width > 0) setWidth(box.width)
  }, [])
  useRepaintOnResize(canvas, measure)

  useEffect(() => {
    const surface = canvas.current
    const context = surface?.getContext('2d')
    if (!surface || !context) return

    paint(context, surface, layout, { width, ink, line })
  }, [layout, width, ink, line])

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {layout.edges.length === 0 ? (
        <p className={WINDOW_CAPTION}>{t('settings.memoryGraphEmpty')}</p>
      ) : (
        <>
          <canvas
            ref={canvas}
            role="img"
            aria-label={t('settings.memoryGraphCount', {
              memories: layout.nodes.length,
              links: layout.edges.length,
            })}
            className="border-base-300 block w-full rounded-lg border"
            style={{ height: STAGE_HEIGHT }}
            onPointerMove={event => setHovered(under(event, layout.nodes))}
            onPointerLeave={() => setHovered(null)}
          />

          <div className="flex items-baseline justify-between gap-3">
            <p className={WINDOW_CAPTION}>
              {t('settings.memoryGraphCount', {
                memories: layout.nodes.length,
                links: layout.edges.length,
              })}
            </p>
            <MemoryGraphReading node={hovered} />
          </div>
        </>
      )}
    </div>
  )
}

function paint(
  context: CanvasRenderingContext2D,
  surface: HTMLCanvasElement,
  layout: MemoryLayout,
  look: { width: number; ink: string; line: string },
): void {
  // The backing store follows the display, or a retina screen draws a blurred graph.
  const ratio = window.devicePixelRatio || 1
  surface.width = look.width * ratio
  surface.height = STAGE_HEIGHT * ratio
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, look.width, STAGE_HEIGHT)

  context.strokeStyle = look.line
  context.globalAlpha = 0.22
  context.beginPath()
  layout.edges.forEach(edge => {
    context.moveTo(edge.from.x, edge.from.y)
    context.lineTo(edge.to.x, edge.to.y)
  })
  context.stroke()

  context.globalAlpha = 1
  context.fillStyle = look.ink
  layout.nodes.forEach(one => {
    context.beginPath()
    context.arc(one.x, one.y, radiusOf(one), 0, Math.PI * 2)
    context.fill()
  })
}

/** Bigger where more memories tie to it, capped: past the cap a dot swallows its neighbours. */
function radiusOf(node: PlacedNode): number {
  return DOT + Math.min(DOT_CAP, node.degree * DOT_PER_LINK)
}

/** The dot under the pointer, or nothing. Generous by six pixels: a 3px target is unaimable. */
function under(
  event: { clientX: number; clientY: number; currentTarget: HTMLCanvasElement },
  nodes: readonly PlacedNode[],
): PlacedNode | null {
  const box = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - box.left
  const y = event.clientY - box.top

  return nodes.find(one => Math.hypot(one.x - x, one.y - y) < radiusOf(one) + 6) ?? null
}
