import type { DocumentNameFailure } from '@shared/domain/documentName'

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
