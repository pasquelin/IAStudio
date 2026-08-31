import { FOLDER_ROOT } from '@shared/domain/folder'

/**
 * The folders the grid has been through, and where it stands in that walk. What the crumbs cannot
 * hold: they name the way UP, and a walk back out of a folder is not a walk up.
 */
export type FolderWalk = {
  trail: readonly string[]
  at: number
}

/** A walk that has only ever been in the project folder. */
export const FOLDER_WALK_START: FolderWalk = { trail: [FOLDER_ROOT], at: 0 }

/** The folder shown. `FOLDER_ROOT` for a walk whose step is missing, which nothing can produce. */
export function walkedTo(walk: FolderWalk): string {
  return walk.trail[walk.at] ?? FOLDER_ROOT
}

/**
 * Walking into a folder DROPS whatever was ahead, the way a browser does: a step taken after
 * going back is a new branch, and keeping the old one would offer a « forward » nobody asked for.
 */
export function walkInto(walk: FolderWalk, folder: string): FolderWalk {
  if (walkedTo(walk) === folder) return walk

  return { trail: [...walk.trail.slice(0, walk.at + 1), folder], at: walk.at + 1 }
}

/** Whether the walk has a step `delta` away — −1 back, 1 forward. */
export function canWalkBy(walk: FolderWalk, delta: number): boolean {
  return walk.trail[walk.at + delta] !== undefined
}

/** The same walk, `delta` steps along — unchanged where there is no such step. */
export function walkedBy(walk: FolderWalk, delta: number): FolderWalk {
  return canWalkBy(walk, delta) ? { ...walk, at: walk.at + delta } : walk
}
