/// <reference lib="webworker" />
import { messageOf } from '@shared/guards'
import { evaluateGraph, transferablesOf } from './csgEvaluate'
import type { CsgRequest, CsgResponse } from './csgMessage'

declare const self: DedicatedWorkerGlobalScope

/**
 * Cuts solids out of solids, off the UI thread — CLAUDE.md invariant 6.
 *
 * A message adapter and nothing else: the arithmetic lives in `csgEvaluate.ts`, where a test can
 * reach it. What a Worker hides, no gate sees — a brush scaled by its matrix came out unscaled
 * and every gate stayed green.
 */
self.addEventListener('message', (event: MessageEvent<CsgRequest>) => {
  const { id, graph } = event.data

  try {
    const mesh = evaluateGraph(graph)
    // Transferred rather than copied: a dense cut is megabytes, and copying it back would spend
    // on the UI thread exactly what the worker was there to save.
    self.postMessage({ id, ok: true, mesh } satisfies CsgResponse, transferablesOf(mesh))
  } catch (error) {
    // An evaluation that raises — a degenerate brush, memory the result could not have — must
    // answer all the same: the other side holds a promise on this id and nothing else settles it.
    self.postMessage({ id, ok: false, error: messageOf(error) } satisfies CsgResponse)
  }
})
