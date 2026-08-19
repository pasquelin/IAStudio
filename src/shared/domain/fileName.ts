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
 * And as long in BYTES, because the two bounds do not say the same thing: ext4 counts `NAME_MAX`
 * in bytes, so eighty code points of emoji are 320 and refused, while eighty of anything Latin are
 * eighty and fine. Measured on 2026-08-19 — macOS wrote all four of ASCII, accented, CJK and
 * astral at eighty code points, so nothing on this machine can show the refusal.
 *
 * Under 255 by the room an extension takes: this bounds a STEM, and the caller appends `.gltf` or
 * `.mtlx` after — five bytes at most across every format the studio writes, eight kept for slack.
 */
export const FILE_NAME_MAX_BYTES = 247

/**
 * Names Windows refuses outright, whatever the extension: `CON.gltf` is as refused as `CON`.
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
 * Whether a name fits the byte bound as it stands — what the two name checks ask before they say
 * a name is INVALID, so a name refused for its length is not reported as malformed.
 */
export function withinFileNameBytes(name: string): boolean {
  return new TextEncoder().encode(name).length <= FILE_NAME_MAX_BYTES
}

/**
 * As many whole code points as fit in `FILE_NAME_MAX_BYTES`, counted one at a time.
 *
 * One at a time rather than by slicing an encoded buffer: cutting bytes lands mid-sequence, and
 * the half-character that comes back is the U+FFFD the code-point cut exists to avoid.
 */
function withinBytes(points: readonly string[]): string {
  let held = ''
  let bytes = 0

  for (const point of points) {
    const width = new TextEncoder().encode(point).length
    if (bytes + width > FILE_NAME_MAX_BYTES) break
    held += point
    bytes += width
  }

  return held
}

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
  // NFC first, and this is one of the two places the studio settles that question — the other is
  // the folder reader, where the disk speaks. `Été` typed here and `Été` pasted from elsewhere
  // are the same six characters on screen and two different strings underneath; left as they
  // came, one of them would be written to disk and the OTHER stored in the catalogue, and every
  // comparison of the two — the explorer joining a row to a file above all — would answer no.
  // Control characters pass on Linux and are refused on Windows, so a name holding one would
  // export on the machine it was written on and nowhere else. `\p{Cc}` and not `< 0x20`: the
  // boundary refuses DEL and the C1 range too, which this used to hand over untouched.
  const cleaned = name
    .normalize('NFC')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    // Dots and spaces together, because the separators just became spaces: `..\..\etc` would
    // otherwise keep the second `..` and open on a folder named for a traversal that failed.
    .replace(/^[.\s]+/, '')
    // And the same at the end: Windows drops a trailing dot silently, so `Niveau.` and `Niveau`
    // become one file there and two everywhere else — the second write would overwrite the first.
    .replace(/[.\s]+$/, '')
    .trim()

  // Cut by code point: `slice` counts UTF-16 units, so a name of emoji came
  // out ending on half a surrogate pair — which `writeFile` then replaced with U+FFFD, letting
  // two different titles land on the same folder.
  const cut = withinBytes([...cleaned].slice(0, FILE_NAME_MAX_LENGTH)).trim()
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
 * A name with room kept for a ` 2` before anything is tried, for whoever suffixes until free.
 *
 * The bound is why this is shared rather than written at each of the two loops that need it:
 * `safeFileName` cuts at `FILE_NAME_MAX_LENGTH`, so a base already that long comes back from
 * `${base} 2` as `base` itself — every candidate then reads as taken, and the loop never ends.
 * Synchronously, in the process that owns every window.
 *
 * Six code points is ` 99999`, past any number of files one folder holds.
 */
export function stemForSuffix(base: string): string {
  return [...base]
    .slice(0, FILE_NAME_MAX_LENGTH - 6)
    .join('')
    .trimEnd()
}

/**
 * Which refusal a rename channel answered with, read back off the error's message.
 *
 * The contract is the message CONTAINS the code — `main/project/documents.ts` says so where it
 * throws. It travels that way because an `invoke` rejection carries a string and nothing else,
 * and both name channels now answer the same four things.
 *
 * Generic over the failure union rather than written twice: the day this becomes a code on the
 * error rather than a substring of it, there is one place to change instead of one per domain,
 * and the second one would be found by nobody — it lives inside a `.catch`.
 */
export function nameFailureOf<Failure extends string>(
  error: unknown,
  failures: readonly Failure[],
  fallback: Failure,
): Failure {
  const message = error instanceof Error ? error.message : ''
  return failures.find(failure => message.includes(failure)) ?? fallback
}

/**
 * A file name without its extension — `Ruelle bleue.png` is `Ruelle bleue`.
 *
 * A leading dot is not an extension: `.gitignore` is a file called that, and three sites had
 * quietly disagreed about it. Shared for that reason rather than for its two lines — the panel
 * that strips a suffix and the backend that swaps one have to answer the same thing, and one of
 * them runs where `node:path` does not exist.
 */
export function stemOf(fileName: string): string {
  const cut = fileName.lastIndexOf('.')
  return cut <= 0 ? fileName : fileName.slice(0, cut)
}

/** What `stemOf` left behind — `.png`, or nothing at all. */
export function extensionOf(fileName: string): string {
  const cut = fileName.lastIndexOf('.')
  return cut <= 0 ? '' : fileName.slice(cut)
}

/**
 * Whether two names are the same FILE, which is not the same question as being equal.
 *
 * Its one caller in each domain used to spell it out: renaming `Ruelle.png` to `ruelle.png` is
 * one file changing case, not a collision with another — and asking the disk would refuse the
 * rename against the very file being renamed.
 */
export function isSameFileName(one: string, other: string): boolean {
  return foldForFileName(one) === foldForFileName(other)
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
