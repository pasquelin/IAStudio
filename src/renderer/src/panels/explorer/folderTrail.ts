import { FOLDER_ROOT, parentOf } from '@shared/domain/folder'

/**
 * The folders leading to `folder`, the project itself first and `folder` last.
 *
 * Walked with `parentOf` rather than split on the separator: one reading of what a path is made of
 * is enough, and it already lives in `shared/` where both processes agree on it.
 */
export function folderTrail(folder: string): readonly string[] {
  const above: string[] = []
  for (let at: string | null = folder; at !== null && at !== FOLDER_ROOT; at = parentOf(at))
    above.unshift(at)

  return [FOLDER_ROOT, ...above]
}
