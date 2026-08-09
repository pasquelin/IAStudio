import { z } from 'zod'
import { readMaterial } from '@shared/domain/texture'
import type { MaterialStyle } from '@shared/domain/style'
import { pathSegment } from '@main/validation'

/** What a window hands back to rename or remove, and a window is trusted for nothing. */
const styleId = pathSegment

export function parseStyleId(value: unknown): string {
  return styleId.parse(value)
}

/** What the panel may set a name to. Trimmed, and never empty — a nameless row cannot be found. */
export function parseStyleName(value: unknown): string {
  return z.string().trim().min(1).max(120).parse(value)
}

/**
 * The values are read by `readMaterial` rather than described again in Zod.
 *
 * Two reasons, and the second is the one that matters. Zod would check the shape; only
 * `readMaterial` holds each value inside what the value MEANS — a roughness of 12 parses as a
 * number and reaches the GGX term as a nonsense alpha. And a second description of fifteen
 * fields is a second thing to keep in step with the first: the file layer of a `.tex` already
 * had this exact problem and answered it here.
 */
const storedStyle = z
  .object({
    id: styleId,
    name: z.string().trim().min(1),
    createdAt: z.string().trim().min(1),
    values: z.unknown(),
  })
  .transform(style => ({ ...style, values: readMaterial(style.values) }))

/**
 * A style arriving from a window, which is a different question from one read off disk: a file
 * entry that makes no sense is dropped so the panel survives it, but a save that makes no sense
 * is a bug on the way in and must be refused rather than written.
 */
export function parseSavedStyle(value: unknown): MaterialStyle {
  return storedStyle.parse(value)
}

const storedStyles = z.array(storedStyle.nullable().catch(null))

/**
 * The file as it comes off disk. It sits in the user's own folder, so an entry that does not
 * parse is dropped rather than failing the read — the move `parseFavoriteIndex` makes, for the
 * same reason: a file the studio cannot make sense of must not be a panel that empties itself.
 */
export function parseStyles(content: string): MaterialStyle[] {
  try {
    const parsed: unknown = JSON.parse(content)
    return storedStyles.parse(parsed).filter(style => style !== null)
  } catch {
    // Not JSON at all, or not a list: beyond recovery whatever we do, and the next save writes
    // over it. Refusing would wedge the file for good.
    return []
  }
}
