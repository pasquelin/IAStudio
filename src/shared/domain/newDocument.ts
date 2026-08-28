import type { DocumentDescriptor, DocumentKind } from './document'
import type { SceneTemplateId } from './sceneTemplate'
import type { UiTemplateId } from './uiTemplates'

/** URL fragment that tells the shared bundle it is rendering the new-document window. */
export const NEW_DOCUMENT_ROUTE = 'new-document'

export function isNewDocumentRoute(hash: string): boolean {
  return hash.replace(/^#/, '') === NEW_DOCUMENT_ROUTE
}

/** What the studio hands the window that names a document about to be made. */
export type NewDocumentAsk = {
  kind: DocumentKind
  /** Where the picker opens — the folder the Explorer is pointing at. */
  folder: string
  /** What the studio would call it. The field opens on it, selected. */
  suggested: string
  /** The project's own name, which heads the first column of the picker. */
  projectName: string
  /**
   * The documents a tab holds and no file does yet: the window reads the project folder for
   * itself, and a name that exists only in a tab is nowhere on disk for it to find.
   */
  open: readonly DocumentDescriptor[]
}

/**
 * What a kind can open ON. Two families and no more, told apart by which kind is being named —
 * a union rather than a string, so a scene id cannot travel from the interface window.
 */
export type DocumentTemplateId = SceneTemplateId | UiTemplateId

/**
 * What a named document is to be: where it goes, what it is called, and — for the two kinds that
 * offer one — what it opens on.
 *
 * `template` is absent for every other kind rather than defaulted here: only a window that DREW
 * the section answers with one, and a value travelling from a kind that showed none would be a
 * choice nobody made.
 */
export type NamedDocumentPlace = {
  title: string
  folder: string
  template?: DocumentTemplateId
}
