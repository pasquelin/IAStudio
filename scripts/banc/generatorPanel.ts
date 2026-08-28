import type { FieldDescriptor } from '@shared/domain/model'
import { partsOfRole } from '@shared/domain/aiRole'
import { registerGenerator, type GeneratorBridge } from '@/assistant/generatorBridge'
import { withBodyExtras } from '@/generation/bodyExtras'
import { referencePictures } from '@/helpers/dynamicForm'
import { resolveModelForCapability } from '@/helpers/modelForCapability'
import { useAiModels } from '@/stores/aiModels'
import { useGeneration } from '@/stores/generation'
import { claimOnSubmit } from '@/stores/generationClaims'
import { useJobs } from '@/stores/jobs'
import { useModels } from '@/stores/models'

/**
 * What the generator PANEL does, for a studio with no window — a stand-in for a surface, never
 * for a rule. Without it every generation refuses `generatorClosed`, and the whole of sections
 * 20 to 22 is scored on a studio nobody asked to generate.
 */
export function installGeneratorPanel(
  schemaOf: (modelId: string) => FieldDescriptor[],
  noteReferences: (assetIds: readonly string[]) => void,
): () => void {
  const armed = (): { modelId: string; values: Record<string, unknown> } | null => {
    const role = useGeneration.getState().forcedCapability
    if (!role) return null

    const models = useModels.getState()
    const modelId = resolveModelForCapability(
      role,
      models.selected[role],
      useAiModels.getState().overview,
    )
    // 🛑 Through `withBodyExtras`, as the real panel does: what the WORKSPACE adds is not in the
    // preset, and a stand-in that skipped it would score a generation the studio never sends.
    const values = withBodyExtras(partsOfRole(role)?.family ?? null, models.preset[role] ?? {})
    return modelId ? { modelId, values } : null
  }

  const references = (): string[] => {
    const body = armed()
    return body ? referencePictures(schemaOf(body.modelId), body.values) : []
  }

  const panel: GeneratorBridge = {
    body: armed,
    submit: async () => {
      const body = armed()
      if (!body) return null

      // Noted at the submit, by the panel's own reading of the schema: what « comme référence »
      // is scored on, and the one place that knows which fields hold a picture.
      noteReferences(references())
      const claim = claimOnSubmit()
      const job = await useJobs.getState().submit({ id: body.modelId }, body.values)
      claim(job)
      return job
    },
    references,
  }

  return registerGenerator(panel)
}
