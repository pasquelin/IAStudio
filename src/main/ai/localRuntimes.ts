import { runtimeEndpointId, type RuntimeEndpointId } from '@shared/domain/aiRuntime'
import type { DownloadProgress, LocalModel, ModelLoader } from '@shared/domain/localModel'

/**
 * The door each loader answers on — what `MemorySnapshot.runtimeBytes` is keyed by, and what an
 * admission plan names when it asks for something to be released.
 *
 * One door per loader today, so the mapping is total. A loader offering two — Ollama's own
 * `/api/chat` beside its OpenAI-compatible one — would key them apart here, which is exactly what
 * `RuntimeEndpointId` was branded for.
 */
export const ENDPOINT_BY_LOADER: Readonly<Record<ModelLoader, RuntimeEndpointId>> = {
  'sherpa-onnx': runtimeEndpointId('sherpa-onnx', 'embedded'),
  ollama: runtimeEndpointId('ollama', 'api-chat'),
  llamacpp: runtimeEndpointId('llamacpp', 'embedded'),
}

/** One turn of a conversation. Roles, because that is how a chat door takes a prompt. */
export type ChatTurn = { readonly role: 'system' | 'user' | 'assistant'; readonly content: string }

export type ChatRequest = {
  readonly model: string
  /**
   * The window asked for. ADR-18 makes this conditional on a runtime DECLARING
   * `context: 'per-request'`; nothing declares anything yet, so the one adapter there is sends it
   * unconditionally. Written rather than promised: a runtime that ignores the field gets it anyway.
   */
  readonly contextTokens: number
  readonly messages: readonly ChatTurn[]
  /** Whether the answer must be one JSON object. Stated by the caller: nothing here guesses. */
  readonly json: boolean
  /**
   * Stops the generation. Invariant 6 of `CLAUDE.md`: every long task is cancellable, and a turn
   * run in this process is the longest of them — a closed window otherwise leaves the model
   * generating to its ceiling with nobody to answer.
   */
  readonly signal?: AbortSignal
}

/** What a load reports while it runs, and what stops it. */
export type LoadOptions = {
  /** From 0 to 1, as the runtime counts it. A runtime reporting nothing simply never calls it. */
  readonly onProgress: (ratio: number) => void
  readonly signal?: AbortSignal
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
  /**
   * Holds the weights in memory, and answers what they take once resident — a MEASUREMENT, where
   * `reservationBytes` is only what a publisher announced. Absent for a runtime that holds
   * nothing between calls.
   */
  load?: (model: LocalModel, options: LoadOptions) => Promise<number>
  /** Frees whatever it holds. Answering does not prove the bytes came back — ADR-19. */
  unload?: () => Promise<void>
}

export type RuntimeReading = {
  /** `false` is ordinary, not a failure: the studio does not start Ollama. */
  readonly ready: boolean
  /** The ids of the models handed in that it holds. Empty when it did not answer. */
  readonly installed: ReadonlySet<string>
  /** The one model resident in memory, of those handed in. `null` when none is. */
  readonly loaded: string | null
}

/**
 * The runtimes the wiring provides, by loader. **Blind spot, written rather than hidden**: nothing
 * checks that every loader has a line — one that has none reads as a runtime that is not answering,
 * which is the honest answer while nothing can install for it.
 */
export type LocalRuntimes = Readonly<Partial<Record<ModelLoader, LocalRuntime>>>

const ABSENT: RuntimeReading = { ready: false, installed: new Set(), loaded: null }

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
        // Nothing is held between calls: the engine is opened per session and closed with it.
        loaded: null,
      }
    },

    install: (model, onProgress, signal) =>
      deps.fetch(model, deps.folderFor(model), onProgress, signal),

    remove: model => deps.removeFiles(model, deps.folderFor(model)),
  }
}
