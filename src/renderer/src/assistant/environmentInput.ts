import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { ENVIRONMENT_KINDS, STUDIO_ENVIRONMENT, type EnvironmentRef } from '@shared/domain/scene'
import { documentNamedOfKind, useDocuments } from '@/stores/documents'
import { withAsset } from './actionHandler'
import { oneOf, textOf } from './actionInputs'

/**
 * What lights a surface, named as `world.environment` names it: a PICTURE by asset id, a sky
 * DOCUMENT by title, `studio` to put both out. Naming one is enough — `kind` is what a client
 * says only to go back to the procedural room.
 *
 * Written once because the scene and the material preview take the same three fields, and a
 * fourth arm of `EnvironmentRef` would otherwise have to be refused in two places.
 */
export function environmentFromInput(
  input: Record<string, unknown>,
  write: (environment: EnvironmentRef | null) => ActionOutcome,
): ActionOutcome | Promise<ActionOutcome> {
  const kind = oneOf(input, 'kind', ENVIRONMENT_KINDS)
  const assetId = textOf(input, 'assetId')
  const title = textOf(input, 'sky')
  // A surface is lit by ONE prefiltered map, so naming both is a request with two answers.
  if (assetId !== null && title !== null) return refused('badInput')
  // The panel answers a kind by taking the first of the project, which from outside would be a
  // reference nobody picked. `studio` beside either is the opposite of both readings of it.
  if (kind === 'skybox' && assetId === null) return refused('badInput')
  if (kind === 'sky' && title === null) return refused('badInput')
  if (kind === 'studio' && (assetId !== null || title !== null)) return refused('badInput')

  // The sky DOCUMENT must EXIST, or the surface follows a reference nothing can resolve.
  const documentId =
    title === null ? null : documentNamedOfKind(useDocuments.getState(), 'skybox', title)
  if (title !== null && documentId === null) return refused('notFound')

  // A source named outright is a source chosen, so `kind` is what a client says only to put one out.
  const environment: EnvironmentRef | null =
    documentId !== null
      ? { kind: 'sky', documentId }
      : assetId !== null
        ? { kind: 'skybox', assetId }
        : kind === 'studio'
          ? STUDIO_ENVIRONMENT
          : null

  // The picture must EXIST too, for the reason the document above does.
  return assetId === null ? write(environment) : withAsset(assetId, () => write(environment))
}
