import { isRecord } from '../guards'
import { gltfStudioExtras } from './gltf'
import { attribute, unescapeXml } from './xmlText'

/**
 * The files an imported document points at, relative to its own folder.
 *
 * Read off the TEXT rather than off a parsed state: this runs before the file is a document of
 * this studio, on something any application may have written.
 */

/**
 * A document that points at siblings is small; above this it is one that CARRIES them.
 *
 * It also bounds the main process, which is where this parses: 4,1 Mo of glTF took 20,2 ms on
 * this Mac, so the ceiling costs about 40 ms once per imported document.
 */
export const SCANNED_BYTES = 8 * 1024 * 1024

const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

function decoded(uri: string): string | null {
  try {
    return decodeURIComponent(uri)
  } catch {
    // A reference nothing can decode names no file, and repairing it would invent one.
    return null
  }
}

/**
 * A reference the studio is willing to follow, or `null`.
 *
 * Refused whole rather than repaired: a scheme — `data:` and `http:` alike — an absolute path, a
 * backslash or a climb above the source folder are each a way of naming a file nobody dropped.
 */
function followable(uri: unknown): string | null {
  if (typeof uri !== 'string' || uri === '' || SCHEME.test(uri)) return null
  const path = decoded(uri)
  if (path === null || path.startsWith('/') || path.includes('\\')) return null

  const segments: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') return null
    segments.push(segment)
  }
  return segments.length > 0 ? segments.join('/') : null
}

const uris = (value: unknown): unknown[] =>
  Array.isArray(value) ? value.filter(isRecord).map(one => one.uri) : []

/** Where a sky hangs its picture: on the node it turns with, never in `images`. */
const skySources = (value: unknown): unknown[] =>
  Array.isArray(value)
    ? value.filter(isRecord).map(node => gltfStudioExtras(node.extras).source)
    : []

function gltfReferences(text: string): unknown[] {
  const parsed: unknown = JSON.parse(text)
  if (!isRecord(parsed)) return []
  return [...uris(parsed.buffers), ...uris(parsed.images), ...skySources(parsed.nodes)]
}

/** Every `filename` input, whatever graph holds it: a foreign material names its nodes as it likes. */
function mtlxReferences(text: string): unknown[] {
  const found: string[] = []
  for (const tag of text.match(/<input\b[^>]*>/g) ?? []) {
    if (attribute(tag, 'type') === 'filename') found.push(unescapeXml(attribute(tag, 'value')))
  }
  return found
}

export function documentReferencesOf(extension: string, text: string): readonly string[] {
  if (text.length > SCANNED_BYTES) return []

  try {
    const found =
      extension === 'gltf' ? gltfReferences(text) : extension === 'mtlx' ? mtlxReferences(text) : []
    return [...new Set(found.flatMap(one => followable(one) ?? []))]
  } catch {
    // A file that will not parse points at nothing, and the import refuses it a moment later.
    return []
  }
}
