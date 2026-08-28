import { documentFolderOf } from '@shared/domain/document'
import { createScript } from '@/app/newDocument'
import { scriptRefOf, useCode } from '@/stores/code'
import { takenDocumentNames, untitledDocumentName, useDocuments } from '@/stores/documents'

/**
 * Puts a generated script in the editor it was launched from, or in a tab of its own.
 *
 * `false` for the one case a person has to be told about: the editor already held changes nobody
 * saved, and `⌘Z` does not reach into it — see `CodeStoreState.wrote`.
 */
export async function landScript(documentId: string | null, source: string): Promise<boolean> {
  if (documentId !== null) {
    const script = scriptRefOf(documentId)
    return script !== null && useCode.getState().wrote(script, source)
  }

  const folder = documentFolderOf('script')
  const taken = takenDocumentNames(useDocuments.getState(), folder)
  const created = await createScript(
    { title: untitledDocumentName(taken, 'script'), folder },
    source,
  )
  return created !== null
}
