import { messageOf } from '@shared/guards'
import { normalised } from './vectors'
import {
  isEmbedCancel,
  type EmbedLoad,
  type EmbedRequest,
  type EmbedResponse,
  type EmbedTexts,
} from './embedProtocol'

/**
 * The embedder, in a process of its own — it opens the GPU and holds one model. Never throws out
 * of the loop: one that dies leaves the main process holding a promise nobody settles.
 */

type Engine = {
  documentPrefix: string
  queryPrefix: string
  embed: (text: string) => Promise<readonly number[]>
  dispose: () => Promise<void>
}

let engine: Engine | null = null
/** Runs the other side gave up on. Read between texts, so a batch stops without waiting it out. */
const dropped = new Set<number>()

const reply = (response: EmbedResponse): void => {
  process.parentPort.postMessage(response)
}

/** 🛑 Imported here, not at the top: loading the addon opens the GPU, and this process is forked
 * before anyone has asked for a vector. */
async function open(request: EmbedLoad): Promise<Engine> {
  const { getLlama } = await import('node-llama-cpp')

  const llama = await getLlama()
  const model = await llama.loadModel({ modelPath: request.weights })
  // A CEILING, not a demand — `electronLlamaPort` spells the same reason: asking outright for
  // the window a manifest declares allocates a cache that fails on every turn.
  const context = await model.createEmbeddingContext({
    contextSize: { max: request.contextTokens },
  })

  return {
    documentPrefix: request.documentPrefix,
    queryPrefix: request.queryPrefix,
    embed: async text => (await context.getEmbeddingFor(text)).vector,
    dispose: async () => {
      await context.dispose()
      await model.dispose()
      await llama.dispose()
    },
  }
}

async function load(request: EmbedLoad): Promise<number> {
  // Whatever was held goes first: two models at once is what the addon cannot do, and the second
  // load fails rather than replacing the first.
  await forget()
  engine = await open(request)

  // The dimensions come from a real answer, never from the manifest: a manifest that said 768
  // where the weights give 384 would have every stored vector silently unusable.
  return (await engine.embed(request.documentPrefix)).length
}

/** One batch, in order: the context is one, so two of them inside it would share a sequence
 * built for one. */
async function embed(
  current: Engine,
  request: EmbedTexts,
  id: number,
): Promise<readonly Float32Array[]> {
  const prefix = request.asQuery ? current.queryPrefix : current.documentPrefix
  const vectors: Float32Array[] = []

  for (const text of request.texts) {
    if (dropped.has(id)) throw new Error('cancelled')
    // Normalised HERE, once: a comparison is then a dot product rather than two square roots
    // per candidate on every question asked.
    vectors.push(normalised(Float32Array.from(await current.embed(prefix + text))))
  }

  return vectors
}

async function forget(): Promise<void> {
  const held = engine
  engine = null
  try {
    await held?.dispose()
  } catch {
    // The weights are on their way out either way; a failed dispose must not stop the next load.
  }
}

async function answer(request: EmbedRequest): Promise<unknown> {
  if (isEmbedCancel(request)) throw new Error('cancelled')
  if (request.op === 'load') return await load(request)

  const current = engine
  // Raised rather than answered empty: an empty batch reads as a model that found nothing to say.
  if (!current) throw new Error('no embedding model is loaded')

  return await embed(current, request, request.id)
}

process.parentPort.on('message', event => {
  const request = event.data as EmbedRequest
  if (isEmbedCancel(request)) dropped.add(request.id)
  void served(request)
})

/** Named rather than a `.then` chain: what it does is answer one request, whatever happens. */
async function served(request: EmbedRequest): Promise<void> {
  try {
    reply({ id: request.id, ok: true, value: await answer(request) })
  } catch (error) {
    reply({ id: request.id, ok: false, error: messageOf(error) })
  } finally {
    // 🛑 Only when the RUN settles. Deleted on the cancel's own turn, the loop parked inside
    // `embed` — 9,7 ms a text — found the set empty at its next look and ran the batch out.
    if (!isEmbedCancel(request)) dropped.delete(request.id)
  }
}
