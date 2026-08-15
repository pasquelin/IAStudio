/**
 * Turning something a human typed into something a file system will hold.
 *
 * It lives in `shared/` because both sides need the same answer: the renderer says whether a
 * name can be used before it is typed in full, and the main process refuses what it is handed
 * regardless — a window does not decide what gets written.
 */

/** As long as a name may be, in code points. Beyond this, file systems start refusing. */
export const FILE_NAME_MAX_LENGTH = 80

/**
 * Names Windows refuses outright, whatever the extension: `CON.scene` is as refused as `CON`.
 * They are device names, not files, and a project holding one cannot be opened there at all —
 * so a title typed on a Mac would travel to a machine that cannot read the document.
 */
const RESERVED = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
])

/**
 * Everything a file name cannot hold, gone. A document is titled by hand — "Brique 1/2" is an
 * ordinary title and a path traversal at the same time — and the export names a folder after it.
 *
 * Falls back rather than throwing: a title made entirely of separators is a title, and refusing
 * to export it would be a dialog with nothing to say. Callers who need to TELL the user their
 * title cannot be a file name ask `isSafeFileName` first — the fallback is for the paths where
 * there is nobody to ask.
 */
export function safeFileName(name: string, fallback = 'texture'): string {
  const printable = [...name]
    // Control characters pass on Linux and are refused on Windows, so a name holding one would
    // export on the machine it was written on and nowhere else. Mapped by code point rather than
    // by a regex, which cannot hold this range without the linter being told to look away.
    .map(character => ((character.codePointAt(0) ?? 0) < 0x20 ? ' ' : character))
    .join('')

  const cleaned = printable
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    // Dots and spaces together, because the separators just became spaces: `..\..\etc` would
    // otherwise keep the second `..` and open on a folder named for a traversal that failed.
    .replace(/^[.\s]+/, '')
    // And the same at the end: Windows drops a trailing dot silently, so `Niveau.` and `Niveau`
    // become one file there and two everywhere else — the second write would overwrite the first.
    .replace(/[.\s]+$/, '')
    .trim()

  // Cut by code point, as it was mapped: `slice` counts UTF-16 units, so a name of emoji came
  // out ending on half a surrogate pair — which `writeFile` then replaced with U+FFFD, letting
  // two different titles land on the same folder.
  const cut = [...cleaned].slice(0, FILE_NAME_MAX_LENGTH).join('').trim()
  if (cut.length === 0) return fallback

  // Suffixed rather than refused, so a document may still be called `Nul`: what Windows reads as
  // a device is the stem alone, and one character more is an ordinary file everywhere.
  return RESERVED.has(cut.toLowerCase()) ? `${cut}_` : cut
}

/**
 * Whether a name survives `safeFileName` whole — what lets a field say no before a write does.
 *
 * The empty name is asked about first: it survives untouched, being nothing to clean, and would
 * otherwise read as perfectly usable.
 */
export function isSafeFileName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length > 0 && safeFileName(name, '') === trimmed
}

/**
 * Two names that would land on the same file, folded together.
 *
 * Case, because APFS and NTFS both ignore it; and NFC, because APFS stores decomposed while
 * most keyboards send composed — `Été` typed twice can arrive as two different strings for the
 * same six bytes on screen.
 *
 * Deliberately NOT `foldForSearch`: stripping diacritics would make `Été` and `Ete` collide, and
 * those are two different files on every system there is.
 */
export function foldForFileName(name: string): string {
  return name.normalize('NFC').toLowerCase()
}
