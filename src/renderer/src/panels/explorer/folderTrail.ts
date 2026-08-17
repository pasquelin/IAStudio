import { FOLDER_ROOT, parentOf } from '@shared/domain/folder'

/**
 * The folders leading to `folder`, the project itself first and `folder` last. Walked with
 * `parentOf` rather than split on the separator, which `shared/` already reads for both processes.
 */
export function folderTrail(folder: string): readonly string[] {
  const above: string[] = []
  for (let at: string | null = folder; at !== null && at !== FOLDER_ROOT; at = parentOf(at))
    above.unshift(at)

  return [FOLDER_ROOT, ...above]
}
