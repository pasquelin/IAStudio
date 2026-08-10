import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { GraphCompileResult, GraphPublishResult, GraphState } from '@shared/domain/graph'
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
    // Nothing drawn, nothing to ask. A new document would otherwise open on "no output marked",
    // in the red of a failure, about a canvas the user has not touched yet: a refusal is only
    // useful once there is something to refuse.
    if (settled.nodes.length === 0) return

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

  // Derived rather than cleared: emptying the canvas must drop the verdict with it, and writing
  // that from the effect is a `setState` in an effect body — which the lint refuses, rightly.
  return settled.nodes.length === 0 ? null : result
}

/**
 * The one line the pane draws, whichever of the two answers fills it.
 *
 * The studio's own tones rather than a colour of this file's: a graph that would not export is
 * the same red as a job that failed, and it is read in the same glance. Written once so a
 * publication and a compile cannot end up in two different corners of the same pane.
 */
function StatusLine({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p
      role="status"
      className={cn(
        'absolute bottom-2 left-2 z-10 text-[11px]',
        ok ? TONE_TEXT.muted : TONE_TEXT.danger,
      )}
    >
      {children}
    </p>
  )
}

/**
 * What the graph would export, said where it is being drawn.
 *
 * Bottom left of the pane, opposite the toolbar: the plan asked for this to be read during the
 * wiring rather than as a 400 at the far end of an export. Nothing is sent anywhere yet — the
 * export lands with step 9 — so what it buys today is the refusals a user cannot guess: "nothing
 * is marked as an output", and the two about a loop and its end, which no other source can emit
 * at all. `validateWorkflowFlow` accepts those two graphs, and this line is their only channel.
 *
 * `published` takes the line over when there is one, and it is deliberate: a publication is a
 * WRITE on the user's account, and the one thing it must never be is silent. It stays until the
 * next attempt rather than fading, so a refusal cannot be missed by looking away.
 */
export function GraphStatus({
  result,
  published,
}: {
  result: GraphCompileResult | null
  published?: GraphPublishResult | null
}) {
  const { t } = useTranslation()

  if (published) {
    const said = published.ok
      ? t('graphPublish.done')
      : published.problem === 'refused'
        ? t('graphPublish.refused')
        : t(`graphCompile.problem.${published.problem}`)

    return <StatusLine ok={published.ok}>{said}</StatusLine>
  }

  if (!result) return null

  const label = result.ok
    ? t('graphCompile.steps', { count: result.steps })
    : t(`graphCompile.problem.${result.problem}`)

  return <StatusLine ok={result.ok}>{label}</StatusLine>
}
