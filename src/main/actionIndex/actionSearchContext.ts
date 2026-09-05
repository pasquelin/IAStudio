import type { SnapshotDocument, StudioSnapshot } from '@shared/domain/studioSnapshot'
import { foldForSearch, searchWords } from '@shared/text'
import type { ActionSearchScope } from './actionIndex'
import { actionQueryIntent } from './actionLexical'

function namedDocument(
  documents: readonly SnapshotDocument[],
  query: string,
): SnapshotDocument | null {
  const request = foldForSearch(query)
  const words = new Set(searchWords(query))
  const navigates = actionQueryIntent(query) === 'execute'
  const matches = documents.filter(document => {
    const title = foldForSearch(document.title)
    const path = document.path ? foldForSearch(document.path) : ''
    return (
      (navigates && title !== '' && request.includes(title)) ||
      (navigates && path !== '' && request.includes(path)) ||
      words.has(document.kind) ||
      words.has(document.workspace)
    )
  })
  return matches.length === 1 ? (matches[0] ?? null) : null
}

export function actionSearchScope(
  snapshot: StudioSnapshot | null,
  query: string,
): ActionSearchScope {
  const request = foldForSearch(query)
  const targetsSelection = snapshot?.selection?.items.some(item => {
    const name = foldForSearch(item.name)
    return name !== '' && request.includes(name)
  })
  const targetDocument = namedDocument(snapshot?.documents ?? [], query)
  return {
    ...(snapshot?.selection && targetsSelection
      ? { target: snapshot.selection.kind }
      : targetDocument
        ? { target: 'document' }
        : {}),
    ...(targetDocument
      ? { document: targetDocument.kind, documentAuthority: 'explicit' }
      : snapshot?.activeDocumentState
        ? { document: snapshot.activeDocumentState.kind, documentAuthority: 'active' }
        : {}),
  }
}
