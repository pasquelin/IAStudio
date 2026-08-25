import { readFile } from 'node:fs/promises'
import type { Asset, AssetQuery } from '@shared/domain/asset'
import type { ActivityReport } from '@main/project/activityLog'
import { fillHoles, TRANSLATIONS } from '@shared/i18n'
import { windowLanguage } from '@main/window/language'
import { embeddedTextures, type EmbeddedTexture } from './glbTextures'
import { isPngBytes, probePng } from '@main/media/png'
import type { WriteRequest } from './localBackend'

/** What each picture a model carries is written as. Anything else keeps the model's own bytes. */
const EXTENSION_OF_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/ktx2': '.ktx2',
}

function extensionOfMime(mimeType: string): string {
  return EXTENSION_OF_MIME[mimeType] ?? '.png'
}

/**
 * What a picture taken out of a model is called: the model's name and the role it played.
 *
 * The same shape a derived channel already uses, and the same words — a base colour extracted
 * from a `.glb` and one computed in the texture space are the same thing on the shelf, so they
 * must not read as two different notions. A slot the studio has no channel for keeps its glTF
 * name, which is a fact about the file rather than a phrase anyone has to translate.
 */
function extractedTextureName(modelName: string, texture: EmbeddedTexture): string {
  const language = windowLanguage()
  const t = TRANSLATIONS[language].texture
  const role = texture.channel ? t.channel[texture.channel] : texture.slot

  return fillHoles(t.derivedName, { name: modelName, channel: role }, language)
}

export type TextureExtractionDeps = {
  /** Where the model's own file sits, or nothing for a row whose bytes are not in the project. */
  fileOf: (source: Asset) => string | null
  /** What is already derived from an asset — this is what makes a second run cost nothing. */
  search: (query: AssetQuery) => Promise<readonly Asset[]>
  write: (request: WriteRequest, bytes: Uint8Array) => Promise<Asset>
  newAssetId: () => string
  /** The project journal. A model that carries no picture is a normal answer, said out loud. */
  record: (entry: ActivityReport) => void
}

export type TextureExtraction = (source: Asset) => Promise<Asset[]>

/**
 * A model's own pictures, taken out into the project so the studio can act on them.
 *
 * Read and written in the MAIN process rather than in a window: the bytes are already a JPEG or a
 * PNG, so this is a file read and a copy — decoding them in the renderer to hand them back would
 * cost a re-encode that softens exactly what the model was painted with (invariant 6).
 *
 * **Idempotent**, and that is what lets it run on its own at import AND from the menu row that
 * catches up the models a project already held: a mesh that already has pictures derived from it
 * is left alone, and answers with them. Without that, the two paths would double every texture of
 * every model imported since.
 *
 * Twice over, because the catalogue can only answer for what is COMMITTED: a run in flight is
 * shared rather than started again. A real model takes seconds to read and write, and the menu
 * row clicked during the automatic run saw a mesh with no derived picture — which it was, for a
 * few seconds more.
 */
export function createTextureExtraction(deps: TextureExtractionDeps): TextureExtraction {
  // What is being extracted right now, per mesh. The catalogue can only answer for what is
  // COMMITTED, and a real model takes seconds to read and write: the import path and the menu row
  // both saw zero derived rows and both extracted, leaving every picture twice.
  const running = new Map<string, Promise<Asset[]>>()

  return source => {
    const already = running.get(source.id)
    if (already) return already

    const run = extract(deps, source).finally(() => running.delete(source.id))
    running.set(source.id, run)
    return run
  }
}

async function extract(deps: TextureExtractionDeps, source: Asset): Promise<Asset[]> {
  if (source.type !== 'mesh') throw new Error(`asset ${source.id} is not a mesh`)

  const already = await deps.search({ derivedFrom: source.id, type: 'texture' })
  if (already.length > 0) return [...already]

  const file = deps.fileOf(source)
  if (!file) throw new Error(`asset ${source.id} has no file to read`)

  // `Buffer` IS a `Uint8Array`, and the reader takes it as one: wrapping it would copy the
  // whole model — several hundred megabytes for a scan, on the process every window waits on.
  // 🛑 The `try` holds the READ alone: the original handler was `readFile`'s second argument, so
  // a reader that throws on a corrupt model is not this journal line, and never was.
  let bytes
  try {
    bytes = await readFile(file)
  } catch (error) {
    // Recorded and rethrown: the window says it too, but a project reopened tomorrow keeps
    // the line — and a file the disk refuses is exactly what one goes back to the journal for.
    deps.record({
      level: 'error',
      topic: 'import',
      messageKey: 'activity.extractFailed',
      params: { name: source.name },
    })
    throw error
  }

  const found = embeddedTextures(bytes)

  const created: Asset[] = []
  for (const texture of found) {
    // Sequential on purpose: a model can carry half a dozen 2048² pictures, and writing them
    // all at once is a burst of tens of megabytes at whatever the disk will take.
    created.push(await deps.write(requestFor(source, texture, deps.newAssetId()), texture.bytes))
  }

  // Said either way. A model with no picture inside it is a normal answer, and one the shelf
  // cannot show on its own: nothing appears, and a gesture that changes nothing without a word
  // reads as a broken menu row.
  deps.record({
    level: 'info',
    // `import`, like every other line about bytes landing in the project.
    topic: 'import',
    ...(created.length > 0
      ? {
          messageKey: 'activity.extractedTextures',
          params: { count: created.length, name: source.name },
        }
      : { messageKey: 'activity.extractedNothing', params: { name: source.name } }),
  })

  return created
}

function requestFor(source: Asset, texture: EmbeddedTexture, id: string): WriteRequest {
  return {
    id,
    name: extractedTextureName(source.name, texture),
    type: 'texture',
    extension: extensionOfMime(texture.mimeType),
    // Traceable both ways: the inspector shows a model's own pictures beside it by asking the
    // catalogue what was derived from it.
    derivedFrom: source.id,
    // One or the other, never both: a slot naming exactly one channel says so through `map`, and
    // the rest carry the slot they came out of so something can later tell an ORM from a coat.
    ...(texture.channel ? { map: texture.channel } : { packedSlot: texture.slot }),
    // A PNG carries its size in its header, which `probePng` reads. A JPEG's is not read at all —
    // nothing probes an extracted picture afterwards, so its row shows none.
    ...(isPngBytes(texture.bytes) ? { probe: probePng(texture.bytes) ?? undefined } : {}),
  }
}
