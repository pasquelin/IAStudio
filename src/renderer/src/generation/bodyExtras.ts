import STUDIO_TYPES from '@game/api/studio.d.ts?raw'
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
const EXTRAS: Record<ModelFamily, ((values: FormValues) => FormValues) | null> = {
  image: null,
  video: null,
  '3d': null,
  audio: null,
  material: null,
  skybox: null,
  code: values => {
    const documentId = activeScriptId(useDocuments.getState())
    const source = documentId === null ? undefined : codeFileOf(documentId)?.source

    // Absent rather than empty with no script in front: what tells `code2code` from `txt2code` is
    // whether there is one to rework, and an empty string is a script that says nothing.
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
export function withBodyExtras(
  family: ModelFamily | null | undefined,
  values: FormValues,
): FormValues {
  const extras = family ? EXTRAS[family] : null
  return extras ? extras(values) : values
}
