import { primaryRoleOf } from '@shared/domain/aiRole'
import type { ModelFamily } from '@shared/domain/model'
import { revealTool } from '@/helpers/revealPanel'
import { useGeneration } from '@/stores/generation'
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
  const role = primaryRoleOf(family)
  if (!role) return

  useModels.getState().prepare(role, modelId, params)
  // 🛑 Both halves, as `prepareEdit` does: the panel reads the model and the values of the
  // operation it settled on, so arming one without forcing the other hands them to whichever
  // operation the current selection happens to point at — silently, with default values.
  useGeneration.getState().forceCapability(role)
  // The generator may well be closed — it is a tool window like any other.
  revealTool('generator')
}
