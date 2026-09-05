import type { StudioSnapshot } from '@shared/domain/studioSnapshot'
import { foldForSearch } from '@shared/text'
import type { ActionSearchScope } from './actionIndex'

export function actionSearchScope(
  snapshot: StudioSnapshot | null,
  query: string,
): ActionSearchScope {
  const request = foldForSearch(query)
  const targetsSelection = snapshot?.selection?.items.some(item => {
    const name = foldForSearch(item.name)
    return name !== '' && request.includes(name)
  })
  return {
    ...(snapshot?.selection && targetsSelection ? { target: snapshot.selection.kind } : {}),
    ...(snapshot?.activeDocumentState
      ? { document: snapshot.activeDocumentState.kind, documentAuthority: 'active' }
      : {}),
  }
}
