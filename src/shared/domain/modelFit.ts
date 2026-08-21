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
 * Whether a model fits, and how comfortably.
 *
 * `unknown` is the DEFAULT rather than a failure — R1 of ADR-19: a probe reading may sort a
 * catalogue and explain a refusal, but it never admits a job, so it can never answer `compatible`
 * either. Saying `unknown` where no runtime answered is the only true reading.
 */
export function fitOf(model: LocalModel, offer: MachineOffer): Compatibility {
  if (modelRefusalOf(model) !== null) return 'incompatible'

  // Disk is checked before memory, and only when the model is not already here: a model that will
  // not fit on the disk cannot be tried at all, whatever the memory says.
  if (!offer.installed && offer.diskFreeBytes !== null) {
    if (offer.diskFreeBytes < downloadBytesOf(model)) return 'insufficient-memory'
  }

  if (model.reservationBytes > offer.snapshot.availableBytes) return 'insufficient-memory'

  // Past two thirds of what is offered, it will run and it will hurt — the reservation is a floor,
  // never the peak (R3), so the margin above it is what the job actually has to grow into.
  if (model.reservationBytes > offer.snapshot.availableBytes * (2 / 3)) return 'slow'

  return offer.snapshot.source === 'runtime' ? 'compatible' : 'unknown'
}

/** Whether a verdict lets the studio offer the model at all. `slow` does: it runs, it warns. */
export function fitAllowsUse(fit: Compatibility): boolean {
  return fit === 'compatible' || fit === 'slow' || fit === 'experimental' || fit === 'unknown'
}
