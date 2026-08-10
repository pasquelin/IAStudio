import { parentPort } from 'node:worker_threads'
import type { TransformRequest } from './transform-protocol'
import { runTransform } from './workflow-transform'

/**
 * The CEL evaluator's thread. Plumbing only — `runTransform` is pure and tested on its own.
 *
 * A thread rather than the main process because an evaluation has no bound: `matches()` is
 * JavaScript's `RegExp`, and a backtracking pattern holds its thread for minutes. Here, the
 * client kills it and starts another; on the main process it would be the studio, frozen.
 */
const port = parentPort
if (!port) throw new Error('transform worker started without a parent port')

port.on('message', (request: TransformRequest) => {
  const verdict = runTransform(request.expression, request.variables)

  port.postMessage(
    verdict.ok
      ? { id: request.id, ok: true, values: verdict.values }
      : { id: request.id, ok: false, reason: verdict.reason },
  )
})
