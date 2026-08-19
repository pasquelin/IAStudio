import { create } from 'zustand'
import { exportRatio, type ExportWatch } from '@shared/domain/exportProgress'
import { newId } from '@/helpers/ids'
import { withoutKey } from '@/helpers/objects'
import { getBridge } from '@/services/bridge'

/** One export in flight, as the status line reads it. Window state — it crosses nothing. */
export type ExportRow = {
  /** Minted here, and the name the cancel channel answers to on the other side. */
  id: string
  /** The document's name, as the file will be called. */
  label: string
  /** 0 to 1 across the whole export. */
  ratio: number
}

type ExportsState = {
  /** What this window is writing out, by the id it minted for each. */
  running: Record<string, ExportRow>

  /** Follows what the main process writes. Returns the unsubscribe. */
  connect: () => () => void
  /** Stops one, on both sides of the boundary — the loop here, and the write over there. */
  cancelExport: (id: string) => void

  begin: (row: ExportRow) => void
  step: (id: string, ratio: number) => void
  end: (id: string) => void
}

/**
 * The stop of each running export, outside the state: an `AbortController` is not something a
 * component renders, and a store that held one would put it in every snapshot comparison.
 */
const stops = new Map<string, AbortController>()

/**
 * The exports in flight, which is what the status line shows and what its stop button reaches.
 * Both halves of invariant 6, which nothing but the video render had — and it had nowhere to say.
 */
export const useExports = create<ExportsState>()((set, get) => ({
  running: {},

  connect: () =>
    getBridge()?.exports.onProgress(({ id, ratio }) => get().step(id, ratio)) ?? (() => {}),

  cancelExport: id => {
    // Locally first: the abort unwinds whatever loop is drawing here, and the main process is
    // told in the same breath for the half that is writing there.
    stops.get(id)?.abort()
    void getBridge()?.exports.cancel(id)
  },

  begin: row => set(state => ({ running: { ...state.running, [row.id]: row } })),

  // An id that has ended is ignored — the last chunk of a bundle and its answer cross, and a row
  // re-created by a late step would sit at 100 % with nothing left to remove it. A ratio that has
  // not moved is ignored too: a bundle steps far more often than a percentage can change.
  step: (id, ratio) =>
    set(state => {
      const row = state.running[id]
      return row && row.ratio !== ratio
        ? { running: { ...state.running, [id]: { ...row, ratio } } }
        : state
    }),

  end: id => set(state => ({ running: withoutKey(state.running, id) })),
}))

/**
 * Runs one export under a row the status line shows and a button that stops it. Answers `null`
 * when it was stopped, which is what every caller here already answers for a dismissed dialog.
 *
 * `work` is handed the id because the bundle needs it: the process writing the file answers the
 * stop by that same name. The row goes whichever way it ends, including a throw.
 */
export async function runExport<T>(
  label: string,
  work: (id: string, watch: ExportWatch) => Promise<T>,
): Promise<T | null> {
  const id = newId()
  const controller = new AbortController()
  stops.set(id, controller)
  useExports.getState().begin({ id, label, ratio: 0 })

  try {
    return await work(id, {
      onStep: (done, total) => useExports.getState().step(id, exportRatio(done, total)),
      signal: controller.signal,
    })
  } catch (error) {
    // The signal rather than the error's own shape: a loop stopped mid-await throws whatever it
    // was in, and a stop the person asked for is not a fault to report.
    if (controller.signal.aborted) return null
    throw error
  } finally {
    stops.delete(id)
    useExports.getState().end(id)
  }
}
