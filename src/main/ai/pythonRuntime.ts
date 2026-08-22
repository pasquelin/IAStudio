import type { DownloadProgress, LocalModel } from '@shared/domain/localModel'
import type { PythonClient } from './pythonClient'
import type {
  FileRuntimeDeps,
  GenerateRequest,
  GenerateResult,
  LoadOptions,
  LocalRuntime,
  RuntimeReading,
} from './localRuntimes'
import { fileRuntime } from './localRuntimes'

/**
 * The engine, as a `LocalRuntime` — the same contract llama.cpp and sherpa-onnx already answer.
 *
 * Installing is not the engine's business: the studio fetches the weights itself, with the digest,
 * the resume and the progress bar `modelInstall.ts` already carries. What the engine adds is
 * everything a Python backend can do and Node cannot — load, unload, generate — and it is handed
 * PATHS to weights the main process has already admitted.
 */

export type PythonRuntimeDeps = FileRuntimeDeps & {
  /**
   * The engine, started on first ask. `null` once it has died too often to keep trying — which is
   * a runtime that is not answering, and says so, rather than a studio that freezes.
   */
  engine: () => Promise<PythonClient | null>
  /** The engine only if it is ALREADY running. Reading the catalogue must never start one. */
  running: () => PythonClient | null
  log: (level: 'info' | 'warn', message: string) => void
}

export function pythonRuntime(deps: PythonRuntimeDeps): LocalRuntime {
  // Installing, removing and reading the disk are exactly what a file runtime does, and doing them
  // through the engine would put a second copy of `modelInstall` in Python.
  const files = fileRuntime(deps)

  let held: string | null = null

  return {
    read: async (models): Promise<RuntimeReading> => {
      const onDisk = await files.read(models)
      // Never STARTED here, only read if already up: a reading runs on every window that
      // connects, and forking the interpreter costs 28,8 ms to answer that nothing is loaded.
      // `ready` follows the disk, which is what the row needs — a model is installable whether
      // or not a Python process happens to be running.
      const engine = deps.running()
      if (!engine) return { ...onDisk, loaded: null }

      // The LEDGER and never `worker.status`: the core answers this itself, where asking a door
      // would fork a Python process and pay 682 MB of imports to be told it holds nothing.
      try {
        const doors = await engine.memory()
        // What we asked for, confirmed by a door that still holds bytes. Either half alone lies:
        // the id without the ledger survives an engine that died, the ledger without the id
        // cannot name what is resident.
        const holding = doors.some(door => door.heldBytes > 0)
        if (!holding || !models.some(model => model.id === held)) held = null
      } catch (error) {
        deps.log('info', `the engine answered nothing for its memory: ${String(error)}`)
        held = null
      }

      return { ...onDisk, loaded: held }
    },

    install: (model, onProgress: (progress: DownloadProgress) => void, signal) =>
      files.install(model, onProgress, signal),

    remove: model => files.remove(model),

    load: async (model: LocalModel, options: LoadOptions): Promise<number> => {
      const engine = await deps.engine()
      if (!engine) throw new Error('the local AI engine is not answering')

      const settled = await engine.job(
        'models.load',
        { modelId: model.id, folder: deps.folderFor(model) },
        { onStep: options.onProgress, signal: options.signal },
      )

      held = model.id
      // A MEASUREMENT, where `reservationBytes` is only what a publisher announced — R3. A backend
      // that answered nothing leaves the reservation, which is the only other figure there is.
      return settled.heldBytes ?? model.reservationBytes
    },

    unload: async () => {
      const engine = await deps.engine()
      if (!engine) return

      await engine.job('models.unload', {})
      held = null
    },

    generate: async (request: GenerateRequest): Promise<GenerateResult> => {
      const engine = await deps.engine()
      if (!engine) throw new Error('the local AI engine is not answering')

      const settled = await engine.job(
        'generate',
        { ...request.fields, prompt: request.prompt, destination: request.destination },
        { onStep: request.onProgress, signal: request.signal },
      )

      const path = settled.path
      if (path === undefined) throw new Error('the engine answered no path for the generation')

      return {
        path,
        // Reported rather than assumed: a model that fell back to the CPU runs at forty times the
        // time it should, and that is indistinguishable from a slow machine unless it is said.
        device: settled.device ?? 'unknown',
        backend: settled.backend ?? 'unknown',
      }
    },
  }
}
