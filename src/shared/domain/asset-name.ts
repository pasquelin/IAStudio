import { ASSET_NAME_MAX_LENGTH } from './asset'

/**
 * Naming an asset. Read by both sides for the reason `checkDocumentName` is: the field says no
 * while the name is being typed, and the main process refuses what it is handed regardless.
 *
 * Shorter than the document's list, and deliberately: an asset's name is not a file name — its
 * file is called after its id, and always has been — so nothing here is about separators, and
 * two assets may perfectly well share a name. Only emptiness and length can be wrong.
 */
export type AssetNameFailure = 'empty' | 'too-long'

export function checkAssetName(name: string): AssetNameFailure | null {
  const trimmed = name.trim()

  if (trimmed.length === 0) return 'empty'
  // By code point, as the bound is meant: a name of emoji is as long as it looks, not twice.
  if ([...trimmed].length > ASSET_NAME_MAX_LENGTH) return 'too-long'

  return null
}

/**
 * How long a generated name may run before it is cut. Shorter than what a name may BE — a
 * caption sits on one line of a tile, and eighty characters are truncated on screen anyway.
 */
const GENERATED_NAME_LENGTH = 60

/**
 * What the studio calls a generation, before anyone renames it.
 *
 * The PROMPT, not the model: « Background footsteps and rustling sounds » says what the thing is
 * where « ElevenLabs Sound Effects 2 » says which machine made it — and a shelf of the latter is
 * a shelf where everything of one model is called the same. The model is not lost; it is read in
 * the inspector's Generation group, where it informs.
 *
 * Falls back on the model's label when there is no prompt, which is an honest case: an upscale
 * and a conversion take a picture and no words.
 */
export function generatedAssetName(source: {
  prompt?: string
  label: string
  index: number
  total: number
}): string {
  const written = cut(collapse(source.prompt ?? '')) || collapse(source.label)

  // Numbered only when there are several, which is the rule this replaces: one output of one job
  // is the thing itself, not the first of a series.
  return source.total > 1 ? `${written} ${source.index + 1}` : written
}

/** Newlines and runs of blanks become one space: a prompt is written over several lines. */
const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim()

/**
 * Cut on a word boundary, by code point.
 *
 * `slice` counts UTF-16 units, so a prompt of emoji came out ending on half a surrogate pair —
 * and cutting mid-word reads as a typo rather than as an abbreviation. Whether it was cut at all
 * is what the ellipsis says; a name that fits gets none.
 */
function cut(text: string): string {
  const points = [...text]
  if (points.length <= GENERATED_NAME_LENGTH) return text

  const kept = points.slice(0, GENERATED_NAME_LENGTH).join('')
  const lastSpace = kept.lastIndexOf(' ')
  // A single word longer than the bound has no boundary to cut on, so it is cut where it stands.
  const stem = lastSpace > 0 ? kept.slice(0, lastSpace) : kept

  return `${stem.replace(/[\s,;:.!?-]+$/, '')}…`
}
