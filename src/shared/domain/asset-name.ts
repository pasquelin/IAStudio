import { ASSET_NAME_MAX_LENGTH } from './asset'
import { isSafeFileName, safeFileName } from './file-name'

/**
 * Naming an asset, which since an asset is named by what it is called is also naming a file.
 * Read by both sides for the reason `checkDocumentName` is: the renderer asks before crossing
 * the boundary, and the main process refuses what it is handed regardless.
 *
 * The two used to be different things — a name in the catalogue, an id on disk — and the user
 * was shown both without a word to say they were one asset: the shelf read « je veux un model
 * avec son skeleton », the explorer `asset_40f76c36-8ad4-4def-a1b3-9125cba4da98.png`, and
 * nothing anywhere joined them. Renaming wrote the catalogue alone, so the two only ever drifted
 * further apart.
 *
 * `duplicate` is the disk's answer and never the field's: two assets landing on one file is
 * something only the folder knows, and it is checked where the write happens.
 */
export type AssetNameFailure = 'empty' | 'too-long' | 'invalid' | 'duplicate'

/**
 * Listed as well as typed, as `DOCUMENT_NAME_FAILURES` is: the failure crosses the IPC boundary
 * as an error message, so one side has to be able to walk them.
 */
export const ASSET_NAME_FAILURES: readonly AssetNameFailure[] = [
  'empty',
  'too-long',
  'invalid',
  'duplicate',
]

/** The file an asset of this name lands on, extension included — `Ruelle bleue.png`. */
export function assetFileName(name: string, extension: string): string {
  return `${safeFileName(name, 'asset')}${extension}`
}

/**
 * Whether a name can be given to an asset, and what is wrong with it otherwise.
 *
 * Everything a FIELD can see, which is everything but the duplicate: the renderer calls it to
 * spare a round trip, the main process calls it again because a window is not what decides what
 * gets written.
 */
export function checkAssetName(name: string): AssetNameFailure | null {
  const trimmed = name.trim()

  if (trimmed.length === 0) return 'empty'
  // By code point, as the bound is meant: a name of emoji is as long as it looks, not twice.
  if ([...trimmed].length > ASSET_NAME_MAX_LENGTH) return 'too-long'
  // Refused rather than quietly cleaned: a name the studio would rewrite is a second name for
  // the asset, and one name is the whole point.
  if (!isSafeFileName(trimmed)) return 'invalid'

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
