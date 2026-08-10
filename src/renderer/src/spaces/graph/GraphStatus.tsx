import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GraphCompileResult, GraphState } from '@shared/domain/graph'
import { TONE_TEXT } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { useDebounced } from '@/hooks/useDebounced'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'

/**
 * Long enough that wiring three nodes in a row asks once, short enough that the answer feels
 * like part of the gesture. The compile is a pure function in the main process — no network, no
 * key — so this paces the IPC round trip rather than an API.
 */
const COMPILE_DEBOUNCE_MS = 400

/**
 * Whether the graph would compile, asked while it is being drawn.
 *
 * The compiler is Scenario's own and lives in the SDK, which only the main process speaks — hence
 * the round trip.
 *
 * **What the debounce does NOT do, and the comment here said it did:** a node dragged changes the
 * graph object without changing anything a flow is made of, so a settled drag still costs one
 * clone of the whole graph across the boundary. It is paced, not avoided. Avoiding it means
 * keying on what the flow actually reads — ids, types, `data`, edges — which is a walk of the
 * graph on every render, so it is a trade rather than a fix, and it waits for a measurement.
 */
export function useGraphCompile(graph: GraphState): GraphCompileResult | null {
  const settled = useDebounced(graph, COMPILE_DEBOUNCE_MS)
  const [result, setResult] = useState<GraphCompileResult | null>(null)

  useEffect(() => {
    // An answer that comes back after the graph moved on would paint a verdict on a graph that
    // no longer exists — the very race `useDebounced` is written against, one layer down.
    let live = true

    void getBridge()
      ?.workflows.compile(settled)
      .then(answer => {
        if (live) setResult(answer)
      })
      .catch(error => reportFailure('graph.compile', 'compile', error))

    return () => {
      live = false
    }
  }, [settled])

  return result
}

/**
 * What the graph would export, said where it is being drawn.
 *
 * Bottom left of the pane, opposite the toolbar: the plan asked for this to be read during the
 * wiring rather than as a 400 at the far end of an export. Nothing is sent anywhere yet — the
 * export lands with step 9 — so what it buys today is the one refusal a user cannot guess,
 * "nothing is marked as an output".
 */
export function GraphStatus({ result }: { result: GraphCompileResult | null }) {
  const { t } = useTranslation()
  if (!result) return null

  // The studio's own tones rather than a colour of this file's: a graph that would not export is
  // the same red as a job that failed, and it is read in the same glance.
  const tone = result.ok ? TONE_TEXT.muted : TONE_TEXT.danger
  const label = result.ok
    ? t('graphCompile.steps', { count: result.steps })
    : t(`graphCompile.problem.${result.problem}`)

  return (
    <p role="status" className={cn('absolute bottom-2 left-2 z-10 text-[11px]', tone)}>
      {label}
    </p>
  )
}
