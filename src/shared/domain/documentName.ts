import { extensionForKind, EXTENSIONS_BY_KIND, type DocumentKind } from './document'
import { foldForFileName, isSafeFileName, safeFileName, stemForSuffix } from './fileName'

/**
 * Naming a document, which since documents are named by what they are called is also naming a
 * file. The two used to be different things — a title in the envelope, a uuid on disk — and the
 * user was shown both without a word to say they were one document.
 *
 * Read by both sides: the renderer asks before crossing the boundary, which spares a round trip
 * for what it can already see, and the main process refuses what it is handed regardless — a
 * window is not what decides what gets written. A refusal reaches the user through the activity
 * journal (`helpers/rename.ts`), the field having closed by the time the disk answers.
 */

/** Long enough for a sentence of a title, short enough for every file system to hold it. */
export const DOCUMENT_NAME_MAX_LENGTH = 80

/**
 * Listed as well as typed: the failure crosses the IPC boundary as an error message, so one
 * side has to be able to walk them. `duplicate` last — it is the only one the disk can raise
 * that the field could not, so it is also the only one worth recognising in a message alone.
 */
export type DocumentNameFailure = 'empty' | 'too-long' | 'invalid' | 'duplicate'

export const DOCUMENT_NAME_FAILURES: readonly DocumentNameFailure[] = [
  'empty',
  'too-long',
  'invalid',
  'duplicate',
]

/** What a folder already holds, as the check needs to see it. */
export type NamedDocument = {
  id: string
  /** The directory entry, extension included — `Niveau.scene`. */
  fileName: string
}

/**
 * The file a document of this name and kind lands on.
 *
 * `wearing` is the extension the document ALREADY has, for a kind that reads more than one: a
 * montage renamed must stay the file it is, not become a second one under the spelling a new
 * document would get.
 */
export function documentFileName(name: string, kind: DocumentKind, wearing?: string): string {
  const extension =
    wearing && EXTENSIONS_BY_KIND[kind].includes(wearing) ? wearing : extensionForKind(kind)
  return `${safeFileName(name, 'document')}${extension}`
}

/**
 * Whether a name can be given to a document, and what is wrong with it otherwise.
 *
 * `selfId` exempts the document being renamed, so keeping its own name is not a duplicate.
 *
 * Duplicates are read on the FILE name rather than the title: `Niveau.scene` and `Niveau.img`
 * are two files and may coexist, which is what the disk says and what the space glyph already
 * tells apart on screen.
 *
 * ALL the spellings of one kind, though — a kind reads more than one while its format is being
 * replaced, and `Bande.seq` beside `Bande.otio` is two montages the tab strip, the explorer and
 * the document list all show under one name, with nothing to tell them apart.
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

  const wanted = spellingsOf(trimmed, kind)
  const taken = existing.some(
    document => document.id !== selfId && wanted.has(foldForFileName(document.fileName)),
  )

  return taken ? 'duplicate' : null
}

/** Every file name this title would wear for this kind, folded as a comparison needs them. */
function spellingsOf(name: string, kind: DocumentKind): ReadonlySet<string> {
  return new Set(
    EXTENSIONS_BY_KIND[kind].map(extension =>
      foldForFileName(documentFileName(name, kind, extension)),
    ),
  )
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
  const free = (name: string): boolean =>
    ![...spellingsOf(name, kind)].some(spelling => taken.has(spelling))

  if (free(base)) return base

  const stem = stemForSuffix(base)

  // No bound: the loop ends on the first free name, and there are only ever as many taken as
  // there are documents in the folder.
  for (let n = 2; ; n += 1) {
    const candidate = `${stem} ${n}`
    if (free(candidate)) return candidate
  }
}
