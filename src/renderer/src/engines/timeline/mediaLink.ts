/**
 * How a montage names the files it draws from, and how one written elsewhere is read back.
 *
 * Relative to the montage's OWN folder, which is what makes a project movable: an absolute link
 * names the machine it was written on, and the same project opened from another disk — a copy, a
 * sync folder, another user — draws nothing at all. Another application resolves a relative URL
 * against the file it read it from, which is the same answer.
 */

/** A project-relative media path, as a URL a montage in `documentFolder` points at. */
export function mediaLinkOf(assetPath: string, documentFolder: string): string {
  const from = documentFolder === '' ? [] : documentFolder.split('/')
  const target = assetPath.split('/')

  let shared = 0
  // Never the last segment: it is the file itself, and a folder sharing its name is not it.
  while (shared < from.length && shared < target.length - 1 && from[shared] === target[shared]) {
    shared += 1
  }

  return [...Array(from.length - shared).fill('..'), ...target.slice(shared)]
    .map(encodeURIComponent)
    .join('/')
}

/**
 * The project-relative path a link names, or `null` when it names somewhere else entirely.
 *
 * `null` for an absolute link — a montage from another machine — where the path says nothing
 * about where the file sits HERE. `relinkedBySuffix` is what answers those.
 */
export function mediaPathOf(targetUrl: string, documentFolder: string): string | null {
  if (isAbsoluteLink(targetUrl)) return null

  const parts = documentFolder === '' ? [] : documentFolder.split('/')
  for (const segment of decodedSegments(targetUrl)) {
    if (segment === '..') parts.pop()
    else if (segment !== '.' && segment !== '') parts.push(segment)
  }
  return parts.join('/')
}

/**
 * The longest tail of an absolute link that names a file of this project — `rushes/take.mp4` out
 * of `file:///Volumes/Other/Cut/rushes/take.mp4`.
 *
 * Longest first, so two takes of one name in two folders are told apart by the folder rather
 * than by whichever the catalogue happened to answer first.
 */
export function relinkedBySuffix(
  targetUrl: string,
  byPath: ReadonlyMap<string, string>,
): string | null {
  const segments = decodedSegments(targetUrl).filter(segment => segment !== '')

  for (let start = 0; start < segments.length; start += 1) {
    const found = byPath.get(segments.slice(start).join('/'))
    if (found !== undefined) return found
  }
  return null
}

/** The file a link names, whatever shape it takes — the last thing left to match on. */
export function mediaNameOf(targetUrl: string): string {
  return decodedSegments(targetUrl).at(-1) ?? ''
}

const isAbsoluteLink = (targetUrl: string): boolean =>
  targetUrl.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(targetUrl)

/**
 * A link split into path segments, each decoded. Segment by segment on purpose: a name holding
 * an encoded `%2F` is one segment, and decoding the whole string first would make it two.
 */
function decodedSegments(targetUrl: string): string[] {
  // The scheme and the host are not path: `file:///a/b` would otherwise start with `file:` and
  // two empty segments, and a suffix match would never line up.
  const scheme = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i.exec(targetUrl)?.[0].length ?? 0

  return targetUrl
    .slice(scheme)
    .split('/')
    .map(segment => {
      try {
        return decodeURIComponent(segment)
      } catch {
        // A stray `%` is not an escape, and a link nobody can decode still names its file.
        return segment
      }
    })
}
