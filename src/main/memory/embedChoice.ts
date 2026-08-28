import {
  EMBEDDING_ROLE,
  providerFor,
  roleChoicesFor,
  type RoleChoices,
} from '@shared/domain/aiRole'
import type { LocalModel } from '@shared/domain/localModel'

/**
 * Which embedding model answers, asked on every recall — so it costs a settings read and nothing
 * else. 🛑 Through `providerFor`: that function carries two arbitrated rules, and written again
 * here the embedding would stop following them the day they move.
 */
export type EmbedChoiceDeps = {
  choices: () => RoleChoices
  byProject: () => Readonly<Record<string, RoleChoices>>
  projectPath: () => string | null
  installedIds: () => ReadonlySet<string>
  modelOf: (modelId: string) => LocalModel | null
}

/**
 * The offer names no other local model and no cloud, and that IS the statement: there is no cloud
 * embedder, and a chosen model that is gone falls back to nothing — another model's vectors do
 * not live in the space the stored ones do.
 */
export function embedModelId(deps: EmbedChoiceDeps): string | null {
  const chosen = providerFor(
    EMBEDDING_ROLE,
    roleChoicesFor(deps.choices(), deps.byProject(), deps.projectPath()),
    { localModelIds: [], installedModelIds: [...deps.installedIds()], cloudIds: [] },
  )

  return chosen?.kind === 'local' ? chosen.modelId : null
}

/** What a load needs: the file, the two prompts, and the window the manifest declares. */
export type EmbedWeights = {
  weights: string
  documentPrefix: string
  queryPrefix: string
  contextTokens: number
}

/** What a manifest declaring no window is loaded with. Its own smallest, not a machine's. */
const DEFAULT_EMBED_TOKENS = 2048

/** Where its weights sit, and what it wants in front of a text. Nothing for an unknown id. */
export function embedWeightsOf(
  deps: EmbedChoiceDeps,
  modelId: string,
  fileOf: (model: LocalModel) => string,
): EmbedWeights | null {
  const model = deps.modelOf(modelId)
  if (model === null) return null

  return {
    weights: fileOf(model),
    documentPrefix: model.embedPrompts?.document ?? '',
    queryPrefix: model.embedPrompts?.query ?? '',
    contextTokens: model.contextTokens ?? DEFAULT_EMBED_TOKENS,
  }
}
