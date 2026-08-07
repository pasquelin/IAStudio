import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'

/**
 * What the status line says on its left: the open project, then the document in front.
 *
 * Its own component because both come from stores, and `Footer` is a layout the settings
 * window renders too — where neither store means anything.
 */
export function Breadcrumb() {
  const project = useProject(state => state.project)
  const title = useDocuments(state =>
    state.activeId ? (state.documents[state.activeId]?.title ?? null) : null,
  )

  if (!project) return null
  return <>{title ? `${project.manifest.name} — ${title}` : project.manifest.name}</>
}
