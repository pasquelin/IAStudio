import type { Compatibility, MemorySnapshot } from './aiMemory'
import { downloadBytesOf, modelRefusalOf, type LocalModel } from './localModel'

/**
 * How a model stands against THIS machine — the verdict a manager shows on every candidate.
 *
 * Kept out of `main/` on purpose: the window explains the verdict and the main process decides on
 * it, so both sides read the same rule rather than two that drift.
 */

/** What the machine offers, as the verdict needs to see it. Free disk is `null` when unreadable. */
export type MachineOffer = {
  readonly snapshot: MemorySnapshot
  readonly diskFreeBytes: number | null
  readonly installed: boolean
}

/**
 * What stands between a model and this machine, or `null` when nothing does.
 *
 * Narrower than the verdict on purpose: `Compatibility` says `insufficient-memory` for a disk
 * that is full as much as for a machine that is small, and a screen that explained the second
 * where the first is true would be telling the person to free the wrong thing.
 */
export type FitObstacle = 'refused' | 'disk' | 'memory' | 'tight'

/** The one decision the verdict and the sentence beside it both read, so neither can drift. */
export function fitObstacleOf(model: LocalModel, offer: MachineOffer): FitObstacle | null {
  if (modelRefusalOf(model) !== null) return 'refused'

  // Disk is checked before memory, and only when the model is not already here: a model that will
  // not fit on the disk cannot be tried at all, whatever the memory says.
  if (!offer.installed && offer.diskFreeBytes !== null) {
    if (offer.diskFreeBytes < downloadBytesOf(model)) return 'disk'
  }

  if (model.reservationBytes > offer.snapshot.availableBytes) return 'memory'

  // Past two thirds of what is offered, it will run and it will hurt — the reservation is a floor,
  // never the peak (R3), so the margin above it is what the job actually has to grow into.
  if (model.reservationBytes > offer.snapshot.availableBytes * (2 / 3)) return 'tight'

  return null
}

const VERDICT: Record<FitObstacle, Compatibility> = {
  refused: 'incompatible',
  disk: 'insufficient-memory',
  memory: 'insufficient-memory',
  tight: 'slow',
}

/** The verdict AND what it names, read in one pass: the caller needs both and they must agree. */
export function fitReadingOf(
  model: LocalModel,
  offer: MachineOffer,
): { fit: Compatibility; obstacle: FitObstacle | null } {
  const obstacle = fitObstacleOf(model, offer)
  if (obstacle !== null) return { fit: VERDICT[obstacle], obstacle }

  return { fit: offer.snapshot.source === 'runtime' ? 'compatible' : 'unknown', obstacle: null }
}

/**
 * Whether a model fits, and how comfortably.
 *
 * `unknown` is the DEFAULT rather than a failure — R1 of ADR-19: a probe reading may sort a
 * catalogue and explain a refusal, but it never admits a job, so it can never answer `compatible`
 * either. Saying `unknown` where no runtime answered is the only true reading.
 */
export function fitOf(model: LocalModel, offer: MachineOffer): Compatibility {
  return fitReadingOf(model, offer).fit
}

/** Whether a verdict lets the studio offer the model at all. `slow` does: it runs, it warns. */
export function fitAllowsUse(fit: Compatibility): boolean {
  return fit === 'compatible' || fit === 'slow' || fit === 'experimental' || fit === 'unknown'
}

/**
 * Whether fetching the weights is worth the disk. A machine too small today may not be tomorrow,
 * so `memory` and `tight` still download; a pair the whitelist refuses never loads, and a disk
 * MEASURED too full now would take the fetch to `ENOSPC`.
 */
export function fitAllowsDownload(obstacle: FitObstacle | null): boolean {
  return obstacle !== 'refused' && obstacle !== 'disk'
}
