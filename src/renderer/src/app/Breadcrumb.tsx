import { useTranslation } from 'react-i18next'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { projectName } from '@shared/domain/project'

/** The status line's left: the open project, the document in front, or neither. */
export function Breadcrumb() {
  const { t } = useTranslation()
  const project = useProject(state => state.project)
  const title = useDocuments(state =>
    state.activeId ? (state.documents[state.activeId]?.title ?? null) : null,
  )

  if (!project) return <>{t('project.none')}</>
  const name = projectName(project.path)

  return <>{title ? `${name} — ${title}` : name}</>
}
