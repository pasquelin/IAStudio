import type { DocumentKind } from '@shared/domain/document'
import type { DocumentNameFailure, NamedDocument } from '@shared/domain/document-name'
import { createMountedHost } from '@/helpers/hostRegistry'

/** What a document is about to be called, put to whoever is showing the field. */
export type DocumentNameRequest = {
  kind: DocumentKind
  /** What the studio would have called it. The field opens on it, selected. */
  suggested: string
  /**
   * What the folder and the open tabs already hold. Carried with the request rather than read
   * from the store by the field: the name is refused where it is TYPED — a name suffixed behind
   * the user's back is a document called something they did not write.
   */
  taken: readonly NamedDocument[]
}

/** Answers with the name to give, or `null` when the creation was called off. */
export type DocumentNamer = (request: DocumentNameRequest) => Promise<string | null>

const host = createMountedHost<DocumentNamer>()

/**
 * Declares the dialog as the place a document is named. Returns the way to take it back down.
 *
 * Mounted by the shell, the way the assistant's confirmer is: every surface that makes a
 * document — the rail's plus button, the home, a sentence said to the assistant — goes through
 * one field. A window showing no dialog has nobody to ask, and numbers the document instead.
 */
export const registerDocumentNamer = host.hold

/** Whoever can ask, or `null` in a window that shows no dialog. */
export const mountedDocumentNamer = host.get

/**
 * What each refusal reads as. Composed at runtime from the failure, so the four keys are named
 * in `dynamic-keys.i18n.test.ts` rather than reached by a literal.
 */
export const DOCUMENT_NAME_REFUSALS: Record<DocumentNameFailure, string> = {
  empty: 'documents.nameEmpty',
  'too-long': 'documents.nameTooLong',
  invalid: 'documents.nameInvalid',
  duplicate: 'documents.nameTaken',
}
