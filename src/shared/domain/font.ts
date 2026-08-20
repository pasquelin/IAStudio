/**
 * What a document names a typeface by, shared by both processes.
 *
 * Here and not in `engines/` for the same reason the scene descriptors are: it is what a saved
 * document holds, and two workspaces hold it — the 3D one extrudes the outlines, the image one
 * draws with them. Neither owns the list.
 *
 * Nothing here parses a font: `shared/` has no runtime dependency. Reading outlines is the
 * renderer's errand and reading a file is the main process's.
 */
import { isRecord } from '../guards'

/**
 * Where a typeface comes from, and therefore how far a document travels with it.
 *
 * An embedded face ships inside the studio, so a scene naming one opens the same on every
 * machine. A system face is whatever the reader happens to have installed — which is the classic
 * missing-font hole, and why one that cannot be found is reported rather than silently swapped.
 */
export type FontSource = 'embedded' | 'system'

export const FONT_SOURCES: readonly FontSource[] = ['embedded', 'system']

/** A typeface as a document names it. The family is the key on both sides. */
export type FontRef = {
  source: FontSource
  family: string
}

/** A typeface the studio ships, and the file its outlines are in. */
export type EmbeddedFont = {
  family: string
  file: string
}

/**
 * The three faces the studio ships, one per shape of letter — so a brand new text is readable
 * before anyone opens a picker, and a scene made on one machine reads the same on the next.
 *
 * All three are under the SIL Open Font License; their terms travel in the same folder, and
 * `scripts/collect-licences.mjs` reads them from there into the Licences window.
 */
export const EMBEDDED_FONTS: readonly EmbeddedFont[] = [
  { family: 'Lato', file: 'Lato-Regular.ttf' },
  { family: 'IBM Plex Serif', file: 'IBMPlexSerif-Regular.ttf' },
  { family: 'IBM Plex Mono', file: 'IBMPlexMono-Regular.ttf' },
]

/** What a text is set in until someone says otherwise. Embedded, so a default never goes missing. */
export const DEFAULT_FONT: FontRef = Object.freeze({ source: 'embedded', family: 'Lato' })

/**
 * Where the renderer fetches an embedded face from. Relative, never absolute: an absolute path
 * resolves against the drive root under `file://` in a packaged build, which is the very lesson
 * the Draco and KTX2 decoders taught next door.
 */
export function embeddedFontUrl(file: string): string {
  return `./fonts/${file}`
}

export function embeddedFontOf(family: string): EmbeddedFont | null {
  return EMBEDDED_FONTS.find(font => font.family === family) ?? null
}

export function isSameFont(one: FontRef, other: FontRef): boolean {
  return one.source === other.source && one.family === other.family
}

/**
 * One string naming a face, for a cache key or a picker row. Source and family both: a machine
 * with Lato installed offers a face under the same name as the one the studio ships, and they
 * are not the same file.
 */
export function fontKey(font: FontRef): string {
  return `${font.source}:${font.family}`
}

/**
 * What a stored value says about a typeface, or the studio's own when it says nothing usable —
 * a document written before texts had a font, a family named as a number, a hand-edited file.
 *
 * An embedded family the studio no longer ships falls back too: keeping the name would promise
 * outlines nothing can produce, and the document would draw nothing rather than draw plainly.
 */
export function readFontRef(value: unknown): FontRef {
  if (!isRecord(value)) return DEFAULT_FONT

  const { source, family } = value
  if (typeof family !== 'string' || family === '') return DEFAULT_FONT
  if (source === 'system') return { source: 'system', family }

  return source === 'embedded' && embeddedFontOf(family)
    ? { source: 'embedded', family }
    : DEFAULT_FONT
}
