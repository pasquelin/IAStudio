import type { RecentOpenRequest } from '@shared/ipc'
import { openProjectFile } from '@/helpers/openProjectFile'
import { useProject } from '@/stores/project'

/**
 * One row of File ▸ Open recent — a project, or a document inside one.
 *
 * The project comes first and the document only if it opened: ONE project is open at a time, so
 * a document of another one is a switch, with the two questions on the way out that any switch
 * asks. A no there leaves both where they were, which is why nothing is opened after a refusal.
 *
 * A row that no longer resolves is the ordinary case for a shelf of shortcuts: the folder moved,
 * the file was renamed. `open` drops the project's row itself; the document's goes on the next
 * write, and until then it is a row that does nothing — which is the honest outcome, and the one
 * the shelf of projects has always given.
 */
export async function openRecent({ project, path }: RecentOpenRequest): Promise<void> {
  const open = useProject.getState().project

  if (open?.path !== project && !(await useProject.getState().open(project))) return
  if (path === undefined) return

  await openProjectFile(path)
}
