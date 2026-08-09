import type { Asset, AssetGeneration } from '@shared/domain/asset'
import type { Job } from '@shared/domain/job'
import type { ModelFamily } from '@shared/domain/model'
import { revealTool } from '@/helpers/reveal-panel'
import { useModels } from '@/stores/models'

/** Keys a body may carry the prompt under, in the order a model is likely to name it. */
const PROMPT_KEYS: readonly string[] = ['prompt', 'text', 'description']

function promptIn(body: Record<string, unknown>): string {
  for (const key of PROMPT_KEYS) {
    const value = body[key]
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return ''
}

function seedIn(body: Record<string, unknown>): number | undefined {
  const seed = body.seed
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed
  // Numeric fields come back as strings from a form control, and a seed is worth recovering:
  // it is the one parameter that makes a generation repeatable.
  const parsed = typeof seed === 'string' ? Number(seed) : Number.NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Opens the generator on a model and the values to run it with.
 *
 * Written once for the three surfaces that offer it — the inspector's "regenerate", the image
 * space's edits, and the home's recipes — because the two statements have an order and a caller
 * that reverses it arms the generator on the wrong model, silently.
 *
 * The seed is deliberately not part of it: replaying one asks for the picture one already has.
 */
export function openGeneratorOn(
  family: ModelFamily,
  modelId: string,
  params: Record<string, unknown>,
): void {
  useModels.getState().prepare(family, modelId, params)
  // The generator may well be closed — it is a tool window like any other.
  revealTool('generator')
}

/**
 * Where an asset came from.
 *
 * Read from the catalogue when it records it, and otherwise reconstituted from the job that
 * produced it — which the renderer submitted itself, so it still holds the body. That covers
 * everything made in this session; a project reopened tomorrow shows what the catalogue kept.
 */
export function generationOf(
  asset: Asset,
  jobs: readonly Job[],
  bodies: Record<string, Record<string, unknown>>,
): AssetGeneration | null {
  if (asset.generation) return asset.generation
  if (!asset.jobId) return null

  const job = jobs.find(candidate => candidate.id === asset.jobId)
  const body = bodies[asset.jobId]
  if (!job || !body) return null

  return {
    modelId: job.modelId,
    modelLabel: job.label,
    prompt: promptIn(body),
    params: body,
    seed: seedIn(body),
  }
}
