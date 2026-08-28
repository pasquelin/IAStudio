import STUDIO_TYPES from '@game/api/studio.d.ts?raw'
import { reworksItsOutput } from '@shared/domain/aiCapability'
import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import type { ModelFamily } from '@shared/domain/model'
import { CODE_API_FIELD, CODE_SOURCE_FIELD } from '@shared/domain/codeGeneration'
import type { FormValues } from '@/helpers/dynamicForm'
import { codeFileOf } from '@/stores/code'
import { activeScriptId, useDocuments } from '@/stores/documents'

/**
 * What a family adds beyond the form — what the WORKSPACE holds and no model schema publishes.
 *
 * A table rather than a branch in the panel, which serves every family and knows none:
 * `Record<ModelFamily, …>` makes the compiler ask for the line of the family that arrives.
 */
const EXTRAS: Record<ModelFamily, ((role: AiRoleId, values: FormValues) => FormValues) | null> = {
  image: null,
  video: null,
  '3d': null,
  audio: null,
  material: null,
  skybox: null,
  code: (role, values) => {
    const documentId = activeScriptId(useDocuments.getState())
    // 🛑 Gated on the OPERATION, not on a script being open — see `landingOfRole`.
    const source = reworksItsOutput(role) && documentId ? codeFileOf(documentId)?.source : undefined

    // Absent rather than empty: an empty string is a script that says nothing.
    return {
      ...values,
      [CODE_API_FIELD]: STUDIO_TYPES,
      ...(source ? { [CODE_SOURCE_FIELD]: source } : {}),
    }
  },
  upscale: null,
  'background-removal': null,
  vectorization: null,
  other: null,
}

/** The body as it is sent: the form, plus whatever the family adds to it. */
export function withBodyExtras(role: AiRoleId | null, values: FormValues): FormValues {
  const family = role === null ? null : partsOfRole(role)?.family
  const extras = family ? EXTRAS[family] : null
  return extras && role ? extras(role, values) : values
}
