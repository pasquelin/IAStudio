import type { BundledMedium } from '@shared/domain/otioz'
import type { OtiozRead } from './otiozRead'

/**
 * What the main process and the bundle worker say to each other. Only PATHS go over, both ways: a
 * montage is measured in gigabytes, and moving them would cost more than the work it takes away.
 */

/** A rush the cut names, paired with where it sits and the entry it takes in the archive. */
export type BundleMedium = BundledMedium & { path: string }

/** One bundle to write. Declared once: the request adds an id, the run adds a watch. */
export type BundleWriteJob = {
  writes: true
  /** Where the bundle lands. Chosen by the save dialog, which needs a live app. */
  path: string
  /** `content.otio`, already serialized by the window that holds the catalogue. */
  content: string
  media: readonly BundleMedium[]
}

/** One bundle to unpack. The folder is made and owned by the caller, cleanup included. */
export type BundleReadJob = {
  writes: false
  /** The archive to open — already held inside somewhere this process is allowed to read. */
  path: string
  /** Where the media land. Already held inside the open project. */
  into: string
}

type BundleJob = BundleWriteJob | BundleReadJob

type BundleRequest = BundleJob & { id: number }

/** Stops a bundle by id, half-written file and all. A montage takes minutes either way. */
export type BundleCancel = { id: number; cancel: true }

export type BundleMessage = BundleRequest | BundleCancel

export function isBundleCancel(message: BundleMessage): message is BundleCancel {
  return 'cancel' in message
}

/**
 * `written: false` and `contents: null` are both a stop — a decision, not a fault, and the
 * difference between answering a file and answering nothing. An error is a `failed`, nothing else.
 */
export type BundleResponse =
  | { id: number; kind: 'progress'; done: number; total: number }
  | { id: number; kind: 'wrote'; written: boolean }
  | { id: number; kind: 'read'; contents: OtiozRead | null }
  | { id: number; kind: 'failed'; error: string }
