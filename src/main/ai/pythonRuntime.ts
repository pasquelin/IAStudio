import type { DownloadProgress, LocalModel } from '@shared/domain/localModel'
import type { RuntimeEndpointId } from '@shared/domain/aiRuntime'
import type { PythonClient } from './pythonClient'
import type {
  FileRuntimeDeps,
  GenerateRequest,
  GenerateResult,
  LoadOptions,
  LocalRuntime,
  RuntimeReading,
} from './localRuntimes'
import { engineDoorOf, engineDoorOfEndpoint, fileRuntime } from './localRuntimes'

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

  /**
   * What each door of this engine was loaded with — a MAP and not one slot, because a door is a
   * process and two modalities are two processes that can be resident at the same moment.
   *
   * 🛑 A backend that counts no bytes — the CPU one, where `_held_bytes` answers `None` — reports
   * nothing to the ledger, so a door that DIED leaves its entry here until the engine itself
   * goes. The studio then reads a model as resident that is not. Written rather than guessed at:
   * the alternative was clearing the map on an empty ledger, which on that backend is every
   * reading, and the model could then never be freed at all.
   */
  const held = new Map<string, string>()

  return {
    read: async (models): Promise<RuntimeReading> => {
      const onDisk = await files.read(models)
      // Never STARTED here, only read if already up: a reading runs on every window that
      // connects, and forking the interpreter costs 28,8 ms to answer that nothing is loaded.
      // `ready` follows the disk, which is what the row needs — a model is installable whether
      // or not a Python process happens to be running.
      const engine = deps.running()
      // Its processes went with it, so it holds nothing — a measurement, not an assumption.
      if (!engine) {
        held.clear()
        return { ...onDisk, loaded: null }
      }

      // The LEDGER and never `worker.status`: the core answers this itself, where asking a door
      // would fork a Python process and pay 682 MB of imports to be told it holds nothing.
      try {
        // A door answering ZERO is a release confirmed. One that is ABSENT is not a denial —
        // a backend with no counter never appears here at all.
        for (const door of await engine.memory()) {
          if (door.heldBytes === 0) held.delete(door.door)
        }
      } catch (error) {
        deps.log('info', `the engine answered nothing for its memory: ${String(error)}`)
      }

      const resident = models.find(model => [...held.values()].includes(model.id))
      return { ...onDisk, loaded: resident?.id ?? null }
    },

    install: (model, onProgress: (progress: DownloadProgress) => void, signal) =>
      files.install(model, onProgress, signal),

    remove: model => files.remove(model),

    load: async (model: LocalModel, options: LoadOptions): Promise<number> => {
      const engine = await deps.engine()
      if (!engine) throw new Error('the local AI engine is not answering')

      const door = engineDoorOf(model.modality)
      const settled = await engine.job(
        'models.load',
        { modelId: model.id, folder: deps.folderFor(model), door },
        { onStep: options.onProgress, signal: options.signal },
      )

      held.set(door, model.id)
      // A MEASUREMENT, where `reservationBytes` is only what a publisher announced — R3. A backend
      // that answered nothing leaves the reservation, which is the only other figure there is.
      return settled.heldBytes ?? model.reservationBytes
    },

    unload: async (endpoint?: RuntimeEndpointId) => {
      // Named or all of them, and never a default: waking a door this runtime never loaded into
      // would fork a Python process to free what it does not hold.
      const doors: readonly string[] = endpoint
        ? [engineDoorOfEndpoint(endpoint)]
        : [...held.keys()]
      const asked = doors.filter(door => held.has(door))
      if (asked.length === 0) return

      const engine = await deps.engine()
      if (!engine) return

      for (const door of asked) {
        await engine.job('models.unload', { door })
        held.delete(door)
      }
    },

    generate: async (request: GenerateRequest): Promise<GenerateResult> => {
      const engine = await deps.engine()
      if (!engine) throw new Error('the local AI engine is not answering')

      const settled = await engine.job(
        'generate',
        {
          ...request.fields,
          prompt: request.prompt,
          destination: request.destination,
          door: engineDoorOf(request.modality),
        },
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
