import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GraphCompileResult, GraphState } from '@shared/domain/graph'
import { TONE_TEXT } from '@/design/styles'
import { bridgeWatchingLogs, installFakeBridge } from '@/services/fake-bridge'
import { forgetReportedFailures } from '@/services/diagnostics'
import { GraphStatus, useGraphCompile } from './GraphStatus'

const graphOf = (id: string): GraphState => ({
  nodes: [{ id, type: 'text', position: { x: 0, y: 0 }, data: { value: id } }],
  edges: [],
  inputKeys: [],
})

/** Subscribed as the canvas subscribes it: the hook and the line it paints are one surface. */
function Live({ graph }: { graph: GraphState }) {
  return <GraphStatus result={useGraphCompile(graph)} />
}

beforeEach(() => {
  // `graph.compile` is not a gesture scope, so a subject already reported stays silent — and the
  // set outlives the test that filled it.
  forgetReportedFailures()
})

describe('what the canvas says of a graph it would export', () => {
  it('says nothing at all until the first answer comes back', () => {
    const { container } = render(<GraphStatus result={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('counts the steps in the language of whoever reads them, singular and plural', () => {
    const { rerender } = render(<GraphStatus result={{ ok: true, steps: 1 }} />)

    expect(screen.getByRole('status')).toHaveTextContent('1 étape')

    rerender(<GraphStatus result={{ ok: true, steps: 2 }} />)

    expect(screen.getByRole('status')).toHaveTextContent('2 étapes')
  })

  /**
   * The studio's own tones rather than a colour of this file's: a graph that would not export is
   * read in the same glance as a job that failed, and one that would is a note beside the canvas.
   */
  it('paints a refusal in the same red as a failure, and a verdict as an aside', () => {
    const { rerender } = render(<GraphStatus result={{ ok: false, problem: 'no-output' }} />)

    expect(screen.getByRole('status')).toHaveClass(TONE_TEXT.danger)
    expect(screen.getByRole('status')).toHaveTextContent('Aucune sortie marquée')

    rerender(<GraphStatus result={{ ok: true, steps: 1 }} />)

    expect(screen.getByRole('status')).toHaveClass(TONE_TEXT.muted)
  })
})

describe('asking the main process whether a graph compiles', () => {
  it('hands over the graph on screen, and paints what comes back', async () => {
    const compile = vi.fn((): Promise<GraphCompileResult> =>
      Promise.resolve({ ok: true, steps: 3 }),
    )
    installFakeBridge({ workflows: { compile } })
    const graph = graphOf('text1')

    render(<Live graph={graph} />)

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3 étapes'))
    // The graph itself, not whatever the hook felt like sending: a compile called with `{}` would
    // answer `no-output` for every graph and the line would still read like an answer.
    expect(compile).toHaveBeenCalledWith(graph)
  })

  /**
   * The race the `live` guard is written against. Two answers are in flight, the older one lands
   * last, and without the guard the canvas ends up wearing a verdict on a graph nobody is
   * drawing any more — the very failure the debounce cannot prevent.
   */
  it('ignores an answer about a graph that has moved on', async () => {
    const answers: Array<(result: GraphCompileResult) => void> = []
    const compile = vi.fn(
      (): Promise<GraphCompileResult> =>
        new Promise(resolve => {
          answers.push(resolve)
        }),
    )
    installFakeBridge({ workflows: { compile } })

    const answer = (call: number, result: GraphCompileResult): void => {
      const resolve = answers[call]
      if (!resolve) throw new Error(`the compiler was never asked a ${call + 1}th time`)
      resolve(result)
    }

    const { rerender } = render(<Live graph={graphOf('text1')} />)
    await waitFor(() => expect(compile).toHaveBeenCalledTimes(1))

    rerender(<Live graph={graphOf('text2')} />)
    await waitFor(() => expect(compile).toHaveBeenCalledTimes(2), { timeout: 3000 })

    answer(1, { ok: true, steps: 2 })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 étapes'))

    // Flushed rather than awaited on a `waitFor`: a stale answer that DOES land paints on the
    // next microtask, and a `waitFor` asserting what is already true would pass before it.
    await act(async () => {
      answer(0, { ok: false, problem: 'invalid' })
    })

    expect(screen.getByRole('status')).toHaveTextContent('2 étapes')
  })

  it('writes a boundary that refuses to the journal, and paints nothing', async () => {
    const { entries } = bridgeWatchingLogs({
      workflows: { compile: () => Promise.reject(new Error('no channel')) },
    })

    render(<Live graph={graphOf('text1')} />)

    await waitFor(() =>
      expect(entries()).toContainEqual(
        expect.objectContaining({ level: 'error', scope: 'graph.compile' }),
      ),
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
