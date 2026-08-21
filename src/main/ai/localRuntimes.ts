import type { DownloadProgress, LocalModel, ModelLoader } from '@shared/domain/localModel'

/** One turn of a conversation. Roles, because that is how a chat door takes a prompt. */
export type ChatTurn = { readonly role: 'system' | 'user' | 'assistant'; readonly content: string }

export type ChatRequest = {
  readonly model: string
  /** The window asked for. Honoured where the runtime declares `context: 'per-request'` — ADR-18. */
  readonly contextTokens: number
  readonly messages: readonly ChatTurn[]
  /** Whether the answer must be one JSON object. Stated by the caller: nothing here guesses. */
  readonly json: boolean
}

/**
 * What a runtime on this machine can do, keyed by LOADER — the unit ADR-20 writes its whitelist on.
 *
 * ONE table and not two: installing and conversing are two capabilities of one thing, and a
 * runtime present in one table and absent from the other reads as ready and fails at the first
 * turn, or reads as dead while it could answer.
 */
export type LocalRuntime = {
  /** One round trip for the whole loader: per-model would cost one request per catalogue entry. */
  read: (models: readonly LocalModel[]) => Promise<RuntimeReading>
  install: (
    model: LocalModel,
    onProgress: (progress: DownloadProgress) => void,
    signal: AbortSignal,
  ) => Promise<void>
  remove: (model: LocalModel) => Promise<void>
  /** Absent for a runtime that holds no conversation — recognition reads audio. */
  chat?: (request: ChatRequest) => Promise<string>
}

export type RuntimeReading = {
  /** `false` is ordinary, not a failure: the studio does not start Ollama. */
  readonly ready: boolean
  /** The ids of the models handed in that it holds. Empty when it did not answer. */
  readonly installed: ReadonlySet<string>
}

/**
 * The runtimes the wiring provides, by loader. **Blind spot, written rather than hidden**: nothing
 * checks that every loader has a line — one that has none reads as a runtime that is not answering,
 * which is the honest answer while nothing can install for it.
 */
export type LocalRuntimes = Readonly<Partial<Record<ModelLoader, LocalRuntime>>>

const ABSENT: RuntimeReading = { ready: false, installed: new Set() }

/**
 * What each loader answers for the models that name it.
 *
 * `report` is not optional: the screen can only ever say "this runtime is not answering", and WHY
 * is the whole of what someone needs to fix it. Swallowed, it is invisible everywhere.
 */
export async function runtimeReadingsOf(
  runtimes: LocalRuntimes,
  models: readonly LocalModel[],
  report: (loader: ModelLoader, why: string) => void,
): Promise<ReadonlyMap<ModelLoader, RuntimeReading>> {
  const readingFor = async (loader: ModelLoader): Promise<RuntimeReading> => {
    const runtime = runtimes[loader]
    if (!runtime) {
      report(loader, 'nothing is wired for this loader')
      return ABSENT
    }

    // A `try` and not a `.catch`: an adapter that threw BEFORE handing back its promise would
    // escape the second, take `compose` down with it, and `report` would never be called — the
    // opposite of what this exists for.
    try {
      return await runtime.read(models.filter(model => model.loader === loader))
    } catch (error) {
      report(loader, String(error))
      return ABSENT
    }
  }

  return new Map(
    await Promise.all(
      [...new Set(models.map(model => model.loader))].map(
        async (loader): Promise<[ModelLoader, RuntimeReading]> => [
          loader,
          await readingFor(loader),
        ],
      ),
    ),
  )
}

/** What a runtime over files this studio fetches itself needs from the disk and the network. */
export type FileRuntimeDeps = {
  /** Where the weights land. One folder for the whole catalogue while it holds one file model. */
  folderFor: (model: LocalModel) => string
  isComplete: (model: LocalModel, folder: string) => Promise<boolean>
  fetch: (
    model: LocalModel,
    folder: string,
    onProgress: (progress: DownloadProgress) => void,
    signal: AbortSignal,
  ) => Promise<void>
  removeFiles: (model: LocalModel, folder: string) => Promise<void>
}

/** Ready by construction: what would have to be answering is this process. It holds no conversation. */
export function fileRuntime(deps: FileRuntimeDeps): LocalRuntime {
  return {
    read: async models => {
      const answers = await Promise.all(
        models.map(model => deps.isComplete(model, deps.folderFor(model))),
      )

      return {
        ready: true,
        installed: new Set(models.filter((_model, index) => answers[index]).map(model => model.id)),
      }
    },

    install: (model, onProgress, signal) =>
      deps.fetch(model, deps.folderFor(model), onProgress, signal),

    remove: model => deps.removeFiles(model, deps.folderFor(model)),
  }
}
