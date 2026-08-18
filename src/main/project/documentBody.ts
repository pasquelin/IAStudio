import { open, readFile } from 'node:fs/promises'
import {
  DOCUMENT_ID_KEY,
  DOCUMENT_KIND_KEY,
  DOCUMENT_VERSION,
  ENVELOPE_LIMIT,
  EXTENSIONS_BY_KIND,
  isDocumentKind,
  STUDIO_METADATA_KEY,
  type DocumentEnvelope,
  type DocumentFile,
  type DocumentKind,
} from '@shared/domain/document'
import { defaultSceneIndex, gltfStudioMetadata, isGltfDocument } from '@shared/domain/gltf'
import { isOtioTimeline, otioStudioMetadata } from '@shared/domain/otio'
import { isRecord, readString } from '@shared/guards'
import { parseDocumentEnvelope } from './validation'

/**
 * How a document's bytes are spelt. A kind of the studio's own is an envelope on its first line
 * and the editor's content under it; a kind held in an OPEN format IS that format, so what the
 * envelope carries is read out of the standard's own metadata instead.
 */
export type DocumentBodyFormat = {
  read: (body: string) => DocumentFile
  write: (document: DocumentFile) => string
  /** What a listing needs, without reading the document under it when the format allows that. */
  readHead: (file: string) => Promise<DocumentEnvelope>
}

/**
 * The field every envelope of the studio carries and no foreign JSON does — `documentEnvelope`
 * makes it required, and it sits within the first few dozen bytes whatever the title.
 *
 * NOT `"version"`: a glTF names one inside `asset`, and the envelope does not even open on it —
 * `write` spreads the draft first, so the line begins `{"title":`.
 */
const ENVELOPE_MARK = '"kind":"'

/**
 * The same question for an open format that has no envelope: is any of this OURS? The studio
 * writes its scene metadata into the first object of the file, so it lands within the same bounded
 * head — and a glTF exported into the project as a mesh carries nothing of the sort.
 */
const STUDIO_MARK = `"${STUDIO_METADATA_KEY}"`

async function firstBytes(file: string): Promise<string> {
  const handle = await open(file, 'r')
  try {
    const buffer = Buffer.alloc(ENVELOPE_LIMIT)
    const { bytesRead } = await handle.read(buffer, 0, ENVELOPE_LIMIT, 0)
    return buffer.toString('utf8', 0, bytesRead)
  } finally {
    await handle.close()
  }
}

/** The one every kind the studio invented is written in, and the one a listing reads short. */
export const ENVELOPED: DocumentBodyFormat = {
  read: envelopedDocument,
  write: document => {
    const { content, ...envelope } = document
    return `${JSON.stringify(envelope)}\n${content}`
  },
  readHead: async file => {
    const head = await firstBytes(file)
    const cut = head.indexOf('\n')
    if (cut !== -1) return parseDocumentEnvelope(JSON.parse(head.slice(0, cut)))

    // Two of ours have no line to read short: a version 1 file is one object, content included,
    // and a manifest whose first line held the base64 of every layer runs past this many bytes.
    // Both are read whole. What is refused is a file that does not OPEN like one of ours — a
    // kind wears the extension of an open format now, so a minified glTF exported into the
    // project reaches here, and reading it whole on the thread that owns every window is a
    // freeze at each listing rather than a slow one.
    if (!head.includes(ENVELOPE_MARK)) throw new Error('No envelope where this file begins')
    return envelopedDocument(await readFile(file, 'utf8'))
  },
}

const OPEN_TIMELINE: DocumentBodyFormat = {
  read: otioDocument,
  write: otioBody,
  // No head of ours to read short: what an envelope carries is spread through the file, so the
  // whole of it is read and parsed. `documents.bench.ts` is what says at which size that hurts.
  readHead: async file => otioDocument(await readFile(file, 'utf8')),
}

/**
 * The container the 3D scene and the sky share. Only the scene has the BYTES to match so far, so
 * this format holds two spellings and the FILE decides between them: a glTF document, or the
 * studio's envelope a sky still writes — and a scene written before the switch.
 */
const OPEN_SCENE: DocumentBodyFormat = {
  read: sceneDocument,
  // Parsed ONCE, and only for the kind that writes glTF: the parse is the price of stamping the
  // title into the standard, and a sky would otherwise pay a whole one to learn it writes an
  // envelope. `documents.bench.ts` is what says what that costs at fifty thousand nodes.
  write: document => {
    const parsed = document.kind === 'scene' ? jsonOrNull(document.content) : null
    return isGltfDocument(parsed) ? gltfBody(parsed, document) : ENVELOPED.write(document)
  },
  // Decided on the bounded head, never by catching a failure: a glTF is one JSON object and has no
  // first line, where a sky's envelope has one. And a glTF with nothing of OURS in its head is a
  // mesh somebody exported into the project — `.gltf` is an asset extension too — so it is turned
  // away rather than read whole at every listing, which is the rule `ENVELOPE_MARK` states.
  readHead: async file => {
    const head = await firstBytes(file)
    const cut = head.indexOf('\n')
    // A first line that PARSES as an envelope, never a first line at all: an indented glTF has
    // one too — it reads `{` — and taking that as an envelope dropped every scene written before
    // the file went compact. Seen on screen, not deduced.
    const first = cut === -1 ? null : jsonOrNull(head.slice(0, cut))
    if (isRecord(first) && !isGltfDocument(first)) return parseDocumentEnvelope(first)

    // Either mark: a version 1 document is one object too, and refusing it on the glTF mark alone
    // made every large legacy scene vanish from the listing — present in the folder, unopenable.
    if (!head.includes(STUDIO_MARK) && !head.includes(ENVELOPE_MARK)) {
      throw new Error('Nothing of the studio where this file begins')
    }
    return sceneDocument(await readFile(file, 'utf8'))
  },
}

const FORMAT_BY_EXTENSION: Record<string, DocumentBodyFormat> = {
  [EXTENSIONS_BY_KIND.sequence]: OPEN_TIMELINE,
  [EXTENSIONS_BY_KIND.scene]: OPEN_SCENE,
}

/** How a file of this extension is spelt — the studio's own envelope for anything unlisted. */
export function bodyFormatOf(extension: string): DocumentBodyFormat {
  return FORMAT_BY_EXTENSION[extension] ?? ENVELOPED
}

/**
 * A file read back: the envelope, and the content left as the string the editor wrote. Nothing
 * here parses an enveloped content — that is the editor's business, on its own thread.
 */
function envelopedDocument(body: string): DocumentFile {
  const cut = body.indexOf('\n')
  const head: unknown = JSON.parse(cut === -1 ? body : body.slice(0, cut))
  const envelope = parseDocumentEnvelope(head)

  // Version 1 holds its whole body as one object, content included. Put back into the current
  // shape rather than refused — that is what the version field was for.
  if (envelope.version === 1) {
    const legacy = isRecord(head) ? head.content : undefined
    return { ...envelope, content: legacy === undefined ? '' : JSON.stringify(legacy) }
  }

  return { ...envelope, content: cut === -1 ? '' : body.slice(cut + 1) }
}

/**
 * The standard file and nothing else — a line of ours in front of it would make the document
 * unreadable to every other application.
 *
 * Checked rather than written verbatim, and it is the one place a save can be stopped: a window
 * that mistook this file's format would otherwise put a body no reader understands into it, and
 * the next listing would drop the document from the project altogether — file there, invisible,
 * with no envelope left to recover it from. The parse is the price of that, on a save alone.
 *
 * The name is stamped from the title so a RENAME reaches the field another application shows —
 * and the id and the kind with it. A timeline from elsewhere carries neither, so it was known by
 * its file NAME alone: renaming it made it a different document, and the tab holding it, its
 * place in the layout and its recent entry were all left pointing at a name nothing wears.
 *
 * Only a save of the document itself reaches here, which is what makes stamping safe: an export
 * lands through the folder writer and never claims the identity of what it copied.
 */
function otioBody(document: DocumentFile): string {
  const parsed: unknown = JSON.parse(document.content)
  if (!isOtioTimeline(parsed)) throw new Error('Refusing to write a montage that is not one')

  const metadata = isRecord(parsed.metadata) ? parsed.metadata : {}
  return JSON.stringify(
    {
      ...parsed,
      ...(document.title ? { name: document.title } : {}),
      metadata: {
        ...metadata,
        [STUDIO_METADATA_KEY]: studioStamp(otioStudioMetadata(parsed), document),
      },
    },
    null,
    2,
  )
}

/**
 * What the studio writes into a file it does not own the shape of: which document it is, and which
 * kind. A file from elsewhere carries neither, so it was known by its file NAME alone — renaming
 * it made it a different document, and every tab, layout slot and recent entry pointed at nothing.
 */
function studioStamp(
  held: Record<string, unknown>,
  document: DocumentFile,
): Record<string, unknown> {
  return {
    ...held,
    ...(document.id ? { [DOCUMENT_ID_KEY]: document.id } : {}),
    [DOCUMENT_KIND_KEY]: document.kind,
  }
}

/** A parse that answers `null` rather than throwing — asked of a body of unknown spelling. */
function jsonOrNull(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

/**
 * A document held in an open format: the file IS the document, so what an envelope would carry is
 * read out of the standard's own metadata. Title and clock stay empty — the file NAME is the title
 * and the disk's own time is the only true clock, one written inside a file never matching it.
 *
 * `defaultKind` is what a file from another application takes, saying nothing of ours;
 * `descriptorOf` is what refuses one this extension could never be.
 */
function openDocument(
  body: string,
  parsed: unknown,
  studioMetadata: (value: unknown) => Record<string, unknown>,
  defaultKind: DocumentKind,
): DocumentFile {
  const studio = studioMetadata(parsed)
  const id = readString(studio, DOCUMENT_ID_KEY, '')
  const claimed = readString(studio, DOCUMENT_KIND_KEY, '')
  return {
    version: DOCUMENT_VERSION,
    kind: isDocumentKind(claimed) ? claimed : defaultKind,
    title: '',
    updatedAt: '',
    ...(id ? { id } : {}),
    content: body,
  }
}

/**
 * A scene document, in whichever of the two spellings its file holds. The glTF is what the studio
 * writes now; the envelope is what a sky still writes, and what a scene written before the switch
 * holds — refusing it would drop those from every listing.
 */
function sceneDocument(body: string): DocumentFile {
  const parsed = jsonOrNull(body)
  if (!isGltfDocument(parsed)) return envelopedDocument(body)

  return openDocument(body, parsed, gltfStudioMetadata, 'scene')
}

/**
 * The standard file and nothing else, its default scene renamed from the title and stamped with
 * the identity `otioBody` stamps, for the same reason. Compact where a montage is indented:
 * indenting a scene of 5 000 nodes takes it from 2 396 Ko to 6 840 Ko — measured 18/08.
 */
function gltfBody(parsed: Record<string, unknown>, document: DocumentFile): string {
  const scenes: unknown[] = Array.isArray(parsed.scenes) ? parsed.scenes : []
  const at = defaultSceneIndex(parsed)
  const held = scenes[at]
  if (!isRecord(held)) return JSON.stringify(parsed)

  const extras = isRecord(held.extras) ? held.extras : {}
  return JSON.stringify({
    ...parsed,
    scenes: scenes.map((scene, index) =>
      index === at
        ? {
            ...held,
            ...(document.title ? { name: document.title } : {}),
            extras: {
              ...extras,
              [STUDIO_METADATA_KEY]: studioStamp(gltfStudioMetadata(parsed), document),
            },
          }
        : scene,
    ),
  })
}

/** A montage as OpenTimelineIO holds it, `.otio` serving two kinds and the file saying which. */
function otioDocument(body: string): DocumentFile {
  const parsed: unknown = JSON.parse(body)
  if (!isOtioTimeline(parsed)) throw new Error('Not an OpenTimelineIO timeline')

  return openDocument(body, parsed, otioStudioMetadata, 'sequence')
}
