import type { SnapshotDocument, StudioSnapshot } from '@shared/domain/studioSnapshot'
import { foldForSearch, searchWords } from '@shared/text'
import type { ActionSearchScope } from './actionIndex'
import { actionQueryIntent } from './actionLexical'

function namedDomainTarget(
  query: string,
  activeDocument: SnapshotDocument['kind'] | undefined,
): 'component' | 'timeline' | null {
  const words = new Set(searchWords(query))
  if (words.has('component') || words.has('composant')) return 'component'
  if (words.has('timeline') || words.has('cinematique')) return 'timeline'
  if (activeDocument === 'scene' && (words.has('fade') || words.has('fondu'))) return 'timeline'
  return null
}

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
  const refersToSelection = /-(?:la|le|les)\b|\b(?:it|them|lui)\b/.test(request)
  const targetsSelection =
    refersToSelection ||
    snapshot?.selection?.items.some(item => {
      const name = foldForSearch(item.name)
      return name !== '' && request.includes(name)
    })
  const targetDocument = namedDocument(snapshot?.documents ?? [], query)
  const domainTarget = namedDomainTarget(query, snapshot?.activeDocumentState?.kind)
  return {
    ...(snapshot?.selection && targetsSelection
      ? { target: snapshot.selection.kind }
      : domainTarget
        ? { target: domainTarget }
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
