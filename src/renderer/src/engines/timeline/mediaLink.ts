/**
 * How a montage names the files it draws from, and how one written elsewhere is read back.
 *
 * Relative to the montage's OWN folder, which is what makes a project movable: an absolute link
 * names the machine it was written on. Another application resolves a relative URL against the
 * file it read it from, which is the same answer.
 */

/** A link taken apart once: its path segments, decoded, and whether it named somewhere else. */
export type MediaLink = { segments: readonly string[]; absolute: boolean }

/** A project-relative media path, as a URL a montage in `documentFolder` points at. */
export function mediaLinkOf(assetPath: string, documentFolder: readonly string[]): string {
  const target = assetPath.split('/')

  let shared = 0
  // Never the last segment: it is the file itself, and a folder sharing its name is not it.
  while (
    shared < documentFolder.length &&
    shared < target.length - 1 &&
    documentFolder[shared] === target[shared]
  ) {
    shared += 1
  }

  return [...Array(documentFolder.length - shared).fill('..'), ...target.slice(shared)]
    .map(encodeURIComponent)
    .join('/')
}

/**
 * A link taken apart. Done once per clip and handed to the three questions below, which each
 * used to decode it again.
 */
export function mediaLinkFrom(targetUrl: string): MediaLink {
  // The scheme and the host are not path: `file:///a/b` would otherwise start with `file:` and
  // two empty segments, and a suffix match would never line up.
  const scheme = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i.exec(targetUrl)?.[0].length ?? 0

  return {
    absolute: targetUrl.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(targetUrl),
    // Segment by segment: a name holding an encoded `%2F` is one segment, and decoding the whole
    // string first would make it two.
    segments: targetUrl
      .slice(scheme)
      .split('/')
      .map(segment => {
        try {
          return decodeURIComponent(segment)
        } catch {
          // A stray per cent is not an escape, and a link nobody can decode still names its file.
          return segment
        }
      }),
  }
}

/**
 * The project-relative path a link names, or `null` when it names somewhere else entirely —
 * a montage from another machine, where the path says nothing about where the file sits HERE.
 */
export function mediaPathOf(link: MediaLink, documentFolder: readonly string[]): string | null {
  if (link.absolute) return null

  const parts = [...documentFolder]
  for (const segment of link.segments) {
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
  link: MediaLink,
  byPath: ReadonlyMap<string, string>,
): string | null {
  const named = link.segments.filter(segment => segment !== '')

  // Trimmed from the left rather than re-joined per turn, which was quadratic in the depth.
  let suffix = named.join('/')
  while (suffix !== '') {
    const found = byPath.get(suffix)
    if (found !== undefined) return found

    const cut = suffix.indexOf('/')
    if (cut === -1) return null
    suffix = suffix.slice(cut + 1)
  }
  return null
}

/** The file a link names — the last thing left to match on. */
export function mediaNameOf(link: MediaLink): string {
  return link.segments.at(-1) ?? ''
}
