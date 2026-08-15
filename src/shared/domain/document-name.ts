import { EXTENSION_BY_KIND, type DocumentKind } from './document'
import { foldForFileName, isSafeFileName, safeFileName } from './file-name'

/**
 * Naming a document, which since documents are named by what they are called is also naming a
 * file. The two used to be different things — a title in the envelope, a uuid on disk — and the
 * user was shown both without a word to say they were one document.
 *
 * Read by both sides for the reason `checkAccountName` is: the field says no while the name is
 * being typed, and the main process refuses what it is handed regardless.
 */

/** Long enough for a sentence of a title, short enough for every file system to hold it. */
export const DOCUMENT_NAME_MAX_LENGTH = 80

export type DocumentNameFailure = 'empty' | 'too-long' | 'invalid' | 'duplicate'

/** What a folder already holds, as the check needs to see it. */
export type NamedDocument = {
  id: string
  /** The directory entry, extension included — `Niveau.scene`. */
  fileName: string
}

/** The file a document of this name and kind lands on. */
export function documentFileName(name: string, kind: DocumentKind): string {
  return `${safeFileName(name, 'document')}${EXTENSION_BY_KIND[kind]}`
}

/**
 * Whether a name can be given to a document, and what is wrong with it otherwise.
 *
 * `selfId` exempts the document being renamed, so keeping its own name is not a duplicate.
 *
 * Duplicates are read on the FILE name rather than the title: `Niveau.scene` and `Niveau.img`
 * are two files and may coexist, which is what the disk says and what the space glyph already
 * tells apart on screen.
 */
export function checkDocumentName(
  name: string,
  kind: DocumentKind,
  existing: readonly NamedDocument[],
  selfId?: string,
): DocumentNameFailure | null {
  const trimmed = name.trim()

  if (trimmed.length === 0) return 'empty'
  if ([...trimmed].length > DOCUMENT_NAME_MAX_LENGTH) return 'too-long'
  // Refused rather than quietly cleaned: a title the studio would rewrite is a second name for
  // the document, and one name is the whole point.
  if (!isSafeFileName(trimmed)) return 'invalid'

  const wanted = foldForFileName(documentFileName(trimmed, kind))
  const taken = existing.some(
    document => document.id !== selfId && foldForFileName(document.fileName) === wanted,
  )

  return taken ? 'duplicate' : null
}

/**
 * The first name of this shape nobody has taken — `Sans titre`, then `Sans titre 2`.
 *
 * For the names the studio engenders itself, where there is nobody to ask: a new document, one
 * opened from an asset, a copy. A name a user TYPED is refused instead, by `checkDocumentName`,
 * because suffixing it would hand them a document called something they did not write.
 */
export function nextFreeDocumentName(
  base: string,
  kind: DocumentKind,
  existing: readonly NamedDocument[],
): string {
  const taken = new Set(existing.map(document => foldForFileName(document.fileName)))
  const free = (name: string): boolean => !taken.has(foldForFileName(documentFileName(name, kind)))

  if (free(base)) return base

  // No bound: the loop ends on the first free name, and there are only ever as many taken as
  // there are documents in the folder.
  for (let n = 2; ; n += 1) {
    const candidate = `${base} ${n}`
    if (free(candidate)) return candidate
  }
}
