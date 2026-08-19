import type { BundledMedium } from '@shared/domain/otioz'

/**
 * What the main process and the bundle worker say to each other. Only PATHS go over: a montage is
 * measured in gigabytes, and moving them would cost more than the zipping it takes away.
 */

/** A rush the cut names, paired with where it sits and the entry it takes in the archive. */
export type BundleMedium = BundledMedium & { path: string }

/** One bundle to write. Declared once: the request adds an id, the run adds a watch. */
export type BundleJob = {
  /** Where the bundle lands. Chosen by the save dialog, which needs a live app. */
  path: string
  /** `content.otio`, already serialized by the window that holds the catalogue. */
  content: string
  media: readonly BundleMedium[]
}

type BundleRequest = BundleJob & { id: number }

/** Stops a bundle by id, half-written file and all. A montage takes minutes to pack. */
export type BundleCancel = { id: number; cancel: true }

export type BundleMessage = BundleRequest | BundleCancel

export function isBundleCancel(message: BundleMessage): message is BundleCancel {
  return 'cancel' in message
}

/** `written: false` is a stop — a decision, not a fault. An error is a `failed` and nothing else. */
export type BundleResponse =
  | { id: number; kind: 'progress'; done: number; total: number }
  | { id: number; kind: 'settled'; written: boolean }
  | { id: number; kind: 'failed'; error: string }
