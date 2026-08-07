import { useTranslation } from 'react-i18next'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'

/**
 * What the status line says on its left: the open project, then the document in front.
 *
 * It carries the "no project" wording too. Left to `Footer` as a fallback, the wording was
 * unreachable the moment anything was passed for it to fall back from — and the line went
 * blank instead.
 */
export function Breadcrumb() {
  const { t } = useTranslation()
  const project = useProject(state => state.project)
  const title = useDocuments(state =>
    state.activeId ? (state.documents[state.activeId]?.title ?? null) : null,
  )

  if (!project) return <>{t('project.none')}</>
  return <>{title ? `${project.manifest.name} — ${title}` : project.manifest.name}</>
}
