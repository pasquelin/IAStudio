import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MEMORY_PAGE, type Memory } from '@shared/domain/assistantMemory'
import { memoryEdgesOf } from '@shared/domain/memoryGraph'
import { orElse } from '@shared/promises'
import { memoryBridge } from '@/services/bridge'
import { paintOn } from '@/engines/core/canvas2d'
import { memoryLayoutOf, type PlacedNode } from '@/engines/memory/memoryLayout'
import { WINDOW_CAPTION } from '@/design/windowStyles'
import { useRepaintOnResize } from '@/hooks/useRepaintOnResize'
import { useToken } from '@/hooks/useToken'
import { useAssistantMemory } from '@/stores/assistantMemory'
import { MEMORY_SHOWN } from '../memoryShown'
import { MemoryGraphReading } from './MemoryGraphReading'

/**
 * What the assistant knows about one project, as points and lines.
 *
 * 🛑 Its own read, never the list's slot: sharing it made opening the graph throw away whatever
 * question the list had been asked, and coming back re-ask it. **It draws at most `MEMORY_PAGE`
 * memories** — the contract caps `limit` there — so a project past a hundred is shown in part,
 * and the count under the canvas is what says how many are actually drawn.
 *
 * What sizes a dot is how many memories tie to it, the one thing a list cannot show. One colour,
 * not one per sort: eight hues would be a decision of the design system, not a panel's.
 */

const STAGE_HEIGHT = 360

/** Before the first measure, and under jsdom, which reports every box at zero. */
const FALLBACK_WIDTH = 560

const DOT = 3.2
const DOT_PER_LINK = 1.15
const DOT_CAP = 9

export function MemoryGraph() {
  const { t } = useTranslation()
  const scope = useAssistantMemory(state => state.scope)
  const [memories, setMemories] = useState<readonly Memory[]>([])
  const canvas = useRef<HTMLCanvasElement>(null)
  const [hovered, setHovered] = useState<PlacedNode | null>(null)
  // 🛑 Held rather than derived at each pointer move: `getBoundingClientRect` forces a layout
  // pass, and the box only moves when the panel is resized — which is what repaints anyway.
  const box = useRef({ left: 0, top: 0, width: FALLBACK_WIDTH, height: STAGE_HEIGHT })

  useEffect(() => {
    let watching = true
    const read = async (): Promise<void> => {
      const held = await orElse(
        memoryBridge()?.list(scope, { states: MEMORY_SHOWN, limit: MEMORY_PAGE }),
        [],
      )
      // Dropped where the scope moved on: two reads in flight settle in any order, and the
      // slower one would draw the other scope's graph.
      if (watching) setMemories(held)
    }

    void read()
    return () => {
      watching = false
    }
  }, [scope])

  const ink = useToken('--color-accent-ink')
  const line = useToken('--color-muted')

  // Solved around the origin, so a panel that grew by a pixel no longer re-solves: only the
  // memories decide the shape, and `paint` translates it onto whatever surface it is given.
  const layout = useMemo(
    () =>
      memoryLayoutOf(
        memories.map(one => ({ id: one.id, type: one.type, label: one.summary })),
        memoryEdgesOf(memories),
      ),
    [memories],
  )

  const paint = useCallback(() => {
    paintOn(canvas.current, (context, surface) => {
      const held = canvas.current?.getBoundingClientRect()
      if (held) box.current = { left: held.left, top: held.top, ...surface }

      context.clearRect(0, 0, surface.width, surface.height)
      context.translate(surface.width / 2, surface.height / 2)

      context.strokeStyle = line
      context.globalAlpha = 0.22
      context.beginPath()
      layout.edges.forEach(edge => {
        context.moveTo(edge.from.x, edge.from.y)
        context.lineTo(edge.to.x, edge.to.y)
      })
      context.stroke()

      context.globalAlpha = 1
      context.fillStyle = ink
      layout.nodes.forEach(one => {
        context.beginPath()
        context.arc(one.x, one.y, radiusOf(one), 0, Math.PI * 2)
        context.fill()
      })
    })
  }, [layout, ink, line])

  useRepaintOnResize(canvas, paint)
  useEffect(paint, [paint])

  const counted = t('settings.memoryGraphCount', {
    memories: layout.nodes.length,
    links: layout.edges.length,
  })

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {layout.edges.length === 0 ? (
        <p className={WINDOW_CAPTION}>{t('settings.memoryGraphEmpty')}</p>
      ) : (
        <>
          <canvas
            ref={canvas}
            role="img"
            aria-label={counted}
            className="border-base-300 block w-full rounded-lg border"
            style={{ height: STAGE_HEIGHT }}
            onPointerMove={event => setHovered(under(event, layout.nodes, box.current))}
            onPointerLeave={() => setHovered(null)}
          />

          <div className="flex items-baseline justify-between gap-3">
            <p className={WINDOW_CAPTION}>{counted}</p>
            <MemoryGraphReading node={hovered} />
          </div>
        </>
      )}
    </div>
  )
}

/** Bigger where more memories tie to it, capped: past the cap a dot swallows its neighbours. */
function radiusOf(node: PlacedNode): number {
  return DOT + Math.min(DOT_CAP, node.degree * DOT_PER_LINK)
}

/**
 * The dot under the pointer, or nothing. Generous by six pixels: a 3px target is unaimable.
 *
 * The centre is subtracted here because the layout is solved around the origin — see `paint`.
 */
function under(
  event: { clientX: number; clientY: number },
  nodes: readonly PlacedNode[],
  box: { left: number; top: number; width: number; height: number },
): PlacedNode | null {
  const x = event.clientX - box.left - box.width / 2
  const y = event.clientY - box.top - box.height / 2

  return nodes.find(one => Math.hypot(one.x - x, one.y - y) < radiusOf(one) + 6) ?? null
}
