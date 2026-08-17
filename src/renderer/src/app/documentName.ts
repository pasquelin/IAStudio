import type { DocumentKind } from '@shared/domain/document'
import type { DocumentNameFailure, NamedDocument } from '@shared/domain/documentName'
import { createMountedHost } from '@/helpers/hostRegistry'

/** What a document is about to be called, put to whoever is showing the field. */
export type DocumentNameRequest = {
  kind: DocumentKind
  /** What the studio would have called it. The field opens on it, selected. */
  suggested: string
  /** Where it would go — the folder the field opens on, which the user may then move. */
  folder: string
  /**
   * What the open tabs already hold, and what each FOLDER holds, asked as the choice moves: the
   * name is refused where it is TYPED — a name suffixed behind the user's back is a document
   * called something they did not write — and a name taken in one folder is free in the next.
   */
  takenIn: (folder: string) => readonly NamedDocument[]
}

/** What a named document is to be: where it goes and what it is called. */
export type NamedDocumentPlace = { title: string; folder: string }

/** Answers with the name and the folder, or `null` when the creation was called off. */
export type DocumentNamer = (request: DocumentNameRequest) => Promise<NamedDocumentPlace | null>

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
