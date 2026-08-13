import type { GraphTransformVariables } from '@shared/domain/graph'
import type { TransformRequest, TransformResponse } from './transform-protocol'

/**
 * The evaluator's thread, reduced to what the client needs. Injected rather than imported so the
 * protocol can be tested without starting one — the same reason `PeaksPort` is.
 */
export type TransformPort = {
  postMessage: (request: TransformRequest) => void
  onMessage: (listener: (response: TransformResponse) => void) => void
  /** The thread died. Whatever it was asked will never be answered. */
  onFailure: (listener: (error: Error) => void) => void
  /** Stops it where it stands — the only thing that ends a runaway regex. */
  terminate: () => void
}

export type TransformClient = {
  /** The text an expression produced, `null` where it produced none. Never throws. */
  evaluate: (
    expression: string,
    variables: GraphTransformVariables,
  ) => Promise<readonly string[] | null>
  /** Drops the thread, if one is up. Called when the app is quitting. */
  close: () => void
}

/**
 * How long one evaluation may take before its thread is killed.
 *
 * An evaluation is arithmetic over a handful of strings and lands in well under a millisecond;
 * this is three orders of magnitude above that, so nothing anyone writes on purpose meets it.
 * What it catches is the pattern nobody meant to write: `matches('^(\\w+ ?)+$')` over ninety
 * characters was measured still running after four minutes.
 */
const TRANSFORM_TIMEOUT_MS = 2000

/**
 * Evaluates CEL off this process, and gives up on a thread that will not answer.
 *
 * **The timeout is the whole point, and it is why this is not a plain call.** A backtracking
 * regex cannot be interrupted from inside — no signal, no callback, no cooperative check — so
 * the only way back is to kill the thread, which is what a worker buys and a function call does
 * not. The next evaluation opens a fresh one.
 *
 * One thread, reused: evaluations are serialised by their ids on it, and starting one costs more
 * than every evaluation a graph performs put together.
 */
export function createTransformClient(
  open: () => TransformPort,
  report: (message: string) => void,
  timeoutMs: number = TRANSFORM_TIMEOUT_MS,
): TransformClient {
  const pending = new Map<number, (answer: readonly string[] | null) => void>()
  let port: TransformPort | undefined
  let nextId = 1

  /** Answers every waiting caller and forgets the thread — it is being killed or already gone. */
  const drop = (why: string): void => {
    const waiting = [...pending.values()]
    pending.clear()
    port = undefined
    for (const answer of waiting) answer(null)
    if (why !== '') report(why)
  }

  const connect = (): TransformPort => {
    if (port) return port

    const opened = open()
    opened.onMessage(response => {
      const answer = pending.get(response.id)
      if (!answer) return
      pending.delete(response.id)

      if (response.ok) answer(response.values)
      else {
        report(response.reason)
        answer(null)
      }
    })
    opened.onFailure(error => {
      // The thread is gone, so the port that names it is too — a later `postMessage` on it would
      // be swallowed without a word and hold its caller for good.
      if (port === opened) drop(`evaluator thread stopped: ${error.message}`)
    })

    port = opened
    return opened
  }

  return {
    evaluate: (expression, variables) =>
      new Promise(resolve => {
        const opened = connect()
        const id = nextId++
        pending.set(id, resolve)

        const timer = setTimeout(() => {
          if (!pending.has(id)) return
          // Killed rather than waited on: an evaluation past this point is a regex that will not
          // come back, and every later evaluation would queue behind it on the same thread.
          opened.terminate()
          if (port === opened) drop(`${expression}: gave up after ${timeoutMs} ms`)
          else resolve(null)
        }, timeoutMs)

        pending.set(id, answer => {
          clearTimeout(timer)
          resolve(answer)
        })

        try {
          opened.postMessage({ id, expression, variables })
        } catch (error) {
          clearTimeout(timer)
          pending.delete(id)
          report(`${expression}: ${error instanceof Error ? error.message : String(error)}`)
          resolve(null)
        }
      }),

    close: () => {
      port?.terminate()
      drop('')
    },
  }
}
