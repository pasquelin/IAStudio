/// <reference lib="webworker" />
/**
 * Wiring only, like `audio.worker.ts`: everything that can be reasoned about lives in
 * `skinVertices.ts`, which needs no worker to be measured.
 *
 * What IS here and nowhere else: coming back for air between slices. A worker reads its message
 * queue only between tasks, so a cancellation sent during one long synchronous walk would sit
 * unread until the walk it was meant to stop had finished.
 */
import { messageOf } from '@shared/guards'
import { isCancel, type SkinIncoming, type SkinRequest, type SkinResponse } from './skinMessage'
import { emptyBinding, skinRange, vertexCountOf } from './skinVertices'
import { loadSkinVerticesWasm } from './skinVerticesWasm'

declare const self: DedicatedWorkerGlobalScope

/** Vertices per slice. Small enough that a cancellation lands promptly on a slow machine. */
const SLICE = 4096

const cancelled = new Set<number>()
const wasmBinding = loadSkinVerticesWasm()

self.addEventListener('message', (event: MessageEvent<SkinIncoming>) => {
  const message = event.data
  if (isCancel(message)) {
    cancelled.add(message.id)
    return
  }
  void run(message)
})

async function run(request: SkinRequest): Promise<void> {
  try {
    const vertices = vertexCountOf(request)
    let wasm
    try {
      wasm = (await wasmBinding)(request)
    } catch {
      // WebAssembly is an optimisation; unsupported runtimes and inputs keep the reference path.
      wasm = undefined
    }
    const fallback = wasm ? undefined : emptyBinding(vertices)

    for (let from = 0; from < vertices; from += SLICE) {
      if (cancelled.delete(request.id)) return

      const to = Math.min(from + SLICE, vertices)
      if (wasm) wasm.skinRange(from, to)
      else if (fallback) skinRange(request, fallback, from, to)
      post({ id: request.id, done: false, progress: from / Math.max(vertices, 1) })
      // Yields the queue: without it every cancel and every progress message would be delivered
      // in one burst once the whole walk was already over.
      await breathe()
    }

    // Checked once more: the last slice may have run while a cancel was on its way.
    if (cancelled.delete(request.id)) return

    const binding = wasm ? wasm.binding() : fallback
    if (!binding) throw new Error('Skinning produced no binding')
    self.postMessage({ id: request.id, done: true, ok: true, ...binding } satisfies SkinResponse, {
      transfer: [binding.skinIndex.buffer, binding.skinWeight.buffer],
    })
  } catch (error) {
    post({ id: request.id, done: true, ok: false, error: messageOf(error) })
  }
}

function post(response: SkinResponse): void {
  self.postMessage(response)
}

function breathe(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}
