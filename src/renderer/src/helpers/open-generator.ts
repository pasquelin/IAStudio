import type { ModelFamily } from '@shared/domain/model'
import { revealTool } from '@/helpers/reveal-panel'
import { useModels } from '@/stores/models'

/**
 * Opens the generator on a model and the values to run it with.
 *
 * Written once for the three surfaces that offer it — the inspector's "regenerate", the image
 * space's edits, and the home's recipes — because the two statements have an order and a caller
 * that reverses it arms the generator on the wrong model, silently.
 *
 * The seed is deliberately not part of it: replaying one asks for the picture one already has.
 *
 * Apart from `generation.ts`, which is what reading an asset's recipe is: a GESTURE that opens a
 * panel has no business inside the module a document store reads a pure answer from. Together,
 * the two closed a cycle — `stores/skyboxes` reached the panel registry through this call, and
 * the registry now reads the project store, which is loaded from the documents themselves.
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
