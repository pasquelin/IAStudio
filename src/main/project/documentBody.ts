import { readFile } from 'node:fs/promises'
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
import {
  defaultSceneIndex,
  gltfStudioMetadata,
  isGltfDocument,
  GLTF_HEAD_LIMIT,
} from '@shared/domain/gltf'
import { isMtlxDocument, MTLX_HEAD_LIMIT } from '@shared/domain/materialX'
import { isOtioTimeline, otioStudioMetadata } from '@shared/domain/otio'
import { ORA_HEAD_LIMIT, ORA_MIMETYPE } from '@shared/domain/openRaster'
import { isRecord, readString } from '@shared/guards'
import { firstBytes } from '@main/persistence'
import { mtlxHeadIn, readMaterialX, writeMaterialX } from '@main/assets/materialXFile'
import {
  oraHeadIn,
  packOpenRaster,
  unpackOpenRaster,
  type OraHead,
} from '@main/assets/openRasterFile'
import { parseDocumentEnvelope, parseOraStack } from './validation'
import { isUiFile } from './uiValidation'

/**
 * How a document's bytes are spelt. A kind of the studio's own is an envelope on its first line
 * and the editor's content under it; a kind held in an OPEN format IS that format, so what the
 * envelope carries is read out of the standard's own metadata instead.
 */
export type DocumentBodyFormat = {
  read: (body: Buffer) => DocumentFile
  /** A string where the format is text and bytes where it is a container — both go to `writeFile`. */
  write: (document: DocumentFile) => string | Uint8Array
  /** What a listing needs, without reading the document under it when the format allows that. */
  readHead: (file: string) => Promise<DocumentHead>
}

/**
 * What a head read answers with: the envelope, plus the body when the format has no short head
 * and the whole file had to be read to find one.
 *
 * `content` is carried rather than dropped so that the caller who wanted the document — an open,
 * a rename — reads the file once instead of twice. An `.otio` of 5 000 clips parses in 17 ms on
 * the thread that owns every window; doing it a second time to answer the same question is the
 * whole of what this field exists to stop.
 */
export type DocumentHead = DocumentEnvelope & { content?: string }

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

/** The one every kind the studio invented is written in, and the one a listing reads short. */
export const ENVELOPED: DocumentBodyFormat = {
  read: body => envelopedDocument(body.toString('utf8')),
  write: document => {
    const { content, ...envelope } = document
    return `${JSON.stringify(envelope)}\n${content}`
  },
  readHead: async file => {
    const head = (await firstBytes(file, ENVELOPE_LIMIT)).toString('utf8')
    const cut = head.indexOf('\n')
    if (cut !== -1) return parseDocumentEnvelope(JSON.parse(head.slice(0, cut)))

    // One of ours has no line to read short: a version 1 file is one object, content included,
    // and is read whole. What is refused is a file that does not OPEN like one of ours — a kind
    // wears the extension of an open format now, so a minified glTF exported into the project
    // reaches here, and reading it whole on the thread that owns every window is a freeze at
    // each listing rather than a slow one.
    if (!head.includes(ENVELOPE_MARK)) throw new Error('No envelope where this file begins')
    return envelopedDocument(await readFile(file, 'utf8'))
  },
}

const OPEN_TIMELINE: DocumentBodyFormat = {
  read: body => otioDocument(body.toString('utf8')),
  write: otioBody,
  // The studio's own block opens the file — it rides on the timeline's `metadata`, the third
  // member — so a listing of long montages reads a bounded head. A montage written before that
  // block carried an id, or one whose take holds a chain too long to fit, falls back on the whole.
  readHead: async file => {
    const bytes = await firstBytes(file, ENVELOPE_LIMIT)
    const head = bytes.toString('utf8')
    if (endedInside(bytes, ENVELOPE_LIMIT)) return otioDocument(head)

    return shortHeadIn(head, 'sequence') ?? otioDocument(await readFile(file, 'utf8'))
  },
}

/**
 * What a listing needs out of a head already in hand, or `null` — and then the caller reads the
 * file. The ID is the half that matters: `foundAt` falls back on the file NAME for a document that
 * has none, so a head answering a kind alone renames every document to its stem, silently.
 */
function shortHeadIn(head: string, defaultKind: DocumentKind): DocumentHead | null {
  const studio = studioMarkIn(head)
  const id = readString(studio, DOCUMENT_ID_KEY, '')
  if (!id) return null

  const claimed = readString(studio, DOCUMENT_KIND_KEY, '')
  return {
    version: DOCUMENT_VERSION,
    kind: isDocumentKind(claimed) ? claimed : defaultKind,
    title: '',
    updatedAt: '',
    id,
  }
}

/**
 * Whether the bounded read holds the WHOLE file, which is then parsed from what is already in hand.
 * A bound only saves on a file bigger than itself: at four kilobytes the short head measured ×0,7
 * of reading the file, 18/08. The limit is passed rather than assumed — two other formats bound
 * their heads elsewhere, and a helper reading `ENVELOPE_LIMIT` would lie to them without a sound.
 */
const endedInside = (bytes: Buffer, limit: number): boolean => bytes.length < limit

/**
 * Every `scenario` block a head holds, merged — a glTF writes one on `asset` and one on its default
 * scene, and only the second names the document. The braces are MATCHED, so a title holding `{`
 * does not end a block and one the head cut short is told from one that fits.
 *
 * Each pass resumes AFTER the block it read, and the first block that does not close ends the walk:
 * every mark past it is inside it, so none of them can close either. Resuming one character later
 * instead re-scanned the same kilobytes once per mark — quadratic on the head, on a listing.
 */
function studioMarkIn(head: string): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  let at = head.indexOf(STUDIO_MARK)

  while (at !== -1) {
    const opens = head.indexOf('{', at + STUDIO_MARK.length)
    if (opens === -1) break

    const closes = closingBrace(head, opens)
    if (closes === -1) break

    const parsed = jsonOrNull(head.slice(opens, closes + 1))
    if (isRecord(parsed)) Object.assign(merged, parsed)
    at = head.indexOf(STUDIO_MARK, closes)
  }

  return merged
}

/** Where the object opening at `opens` closes, or `-1` when the head cut it short. */
function closingBrace(head: string, opens: number): number {
  let depth = 0
  let quoted = false

  for (let at = opens; at < head.length; at += 1) {
    if (quoted) {
      if (head[at] === '\\') at += 1
      else if (head[at] === '"') quoted = false
      continue
    }

    if (head[at] === '"') quoted = true
    else if (head[at] === '{') depth += 1
    else if (head[at] === '}' && (depth -= 1) === 0) return at
  }

  return -1
}

/**
 * A layered picture as OpenRaster holds it: a ZIP, and the studio's own state inside it.
 *
 * `content` is the STACK, as JSON — the tree another application reads out of `stack.xml`, plus
 * the studio's serialized canvas under `studio`. The pixels never go through it: they are the
 * draft's `parts`, and they reach the container as bytes.
 *
 * The head is the first `ORA_HEAD_LIMIT` bytes and nothing more. A container of ten 4K layers is
 * a hundred megabytes; reading one per document at every listing is what this exists to refuse.
 */
const OPEN_RASTER: DocumentBodyFormat = {
  read: body => {
    const { stack, surfaces } = unpackOpenRaster(body)
    return {
      ...oraEnvelope(oraHeadIn(body)),
      content: JSON.stringify(stack),
      parts: surfaces,
    }
  },
  /**
   * NO `Thumbnails/thumbnail.png`, and it is a decision rather than an oversight: making one
   * needs `nativeImage`, which needs a live app, which this module must not require — its whole
   * suite runs without one. `savePicture` writes an asset and has an app, so it passes one.
   *
   * What it costs: a third-party file manager that reads only that entry draws a blank tile.
   * Every ORA reader has `mergedimage.png`, which the spec REQUIRES and this always writes, and
   * the studio's own tiles fall back to it — so nothing inside the app notices.
   */
  write: document =>
    packOpenRaster(
      { stack: parseOraStack(JSON.parse(document.content)), surfaces: document.parts ?? [] },
      // The content is the caller's; the envelope is the file layer's own, exactly as the first
      // line of an enveloped document is. `parts` is left out for the same reason `content` is:
      // they are the container's own entries, and naming them twice would let the two disagree.
      JSON.stringify(envelopeOf(document)),
    ),
  readHead: async file => oraEnvelope(oraHeadIn(await firstBytes(file, ORA_HEAD_LIMIT))),
}

/**
 * What a container says about itself. A picture written elsewhere carries no envelope of ours,
 * and is a document all the same — known by its file name, exactly as one written before
 * version 3 is.
 *
 * Bytes that are NOT a container are refused rather than read as an empty document: a `.ora` the
 * user copied a scene into would otherwise be listed as an image, open as nothing, and be
 * overwritten by the next ⌘S. The mimetype is what tells them apart, as the spec says to.
 */
function oraEnvelope({ mimetype, envelope }: OraHead): DocumentEnvelope {
  if (mimetype !== ORA_MIMETYPE) throw new Error('Not an OpenRaster container')
  if (!envelope) return { version: DOCUMENT_VERSION, kind: 'image', title: '', updatedAt: '' }
  return parseDocumentEnvelope(JSON.parse(envelope))
}

/** What the file layer stamps into a container of its own, whichever standard the container is. */
function envelopeOf({
  version,
  kind,
  title,
  updatedAt,
  id,
  sourceAssetId,
}: DocumentFile): DocumentEnvelope {
  return {
    version,
    kind,
    title,
    updatedAt,
    ...(id ? { id } : {}),
    ...(sourceAssetId ? { sourceAssetId } : {}),
  }
}

/**
 * The container the 3D scene and the sky share, and both write it as real glTF now. What tells
 * the two apart is the file's own studio metadata and never the extension — and a `.gltf` a
 * project held before the switch still opens, its envelope on a first line of ours.
 */
const OPEN_SCENE: DocumentBodyFormat = {
  read: body => sceneDocument(body.toString('utf8')),
  // Parsed ONCE: the parse is the price of stamping the title into the standard, and a document
  // still written the studio's own way falls back rather than paying it at all.
  write: document => {
    const parsed = jsonOrNull(document.content)
    return isGltfDocument(parsed) ? gltfBody(parsed, document) : ENVELOPED.write(document)
  },
  // Decided on the bounded head, never by catching a failure: a glTF is one JSON object and has no
  // first line, where an envelope of ours has one. And a glTF with nothing of OURS in its head is
  // a mesh somebody exported into the project — `.gltf` is an asset extension too — so it is
  // turned away rather than read whole at every listing, which is the rule `ENVELOPE_MARK` states.
  readHead: async file => {
    // `GLTF_HEAD_LIMIT` rather than the envelope's: `shared/domain/gltf.ts` declares it for exactly
    // this read, and says why it is the larger of the two — the whole `asset` shares that line.
    const bytes = await firstBytes(file, GLTF_HEAD_LIMIT)
    const head = bytes.toString('utf8')
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
    if (endedInside(bytes, GLTF_HEAD_LIMIT)) return sceneDocument(head)

    // `asset` names the document AND its kind, and `gltfBody` writes it first, so a big scene is
    // listed without being parsed. One written before that stamp carried the id falls back below.
    return shortHeadIn(head, 'scene') ?? sceneDocument(await readFile(file, 'utf8'))
  },
}

/**
 * What the `scenariodocument` attribute carries — the same two fields a glTF stamps, and for the
 * same reason: the title is the file's own name and the clock is the disk's, so neither is
 * written where it could go stale.
 */
function mtlxStamp(envelope: string): { id: string; kind: string } {
  const held = envelope ? jsonOrNull(envelope) : null
  const studio = isRecord(held) ? held : {}
  return {
    id: readString(studio, DOCUMENT_ID_KEY, ''),
    kind: readString(studio, DOCUMENT_KIND_KEY, ''),
  }
}

function mtlxEnvelope(envelope: string): DocumentEnvelope {
  const { id, kind } = mtlxStamp(envelope)
  return {
    version: DOCUMENT_VERSION,
    kind: isDocumentKind(kind) ? kind : 'material',
    title: '',
    updatedAt: '',
    ...(id ? { id } : {}),
  }
}

/**
 * A material document, in whichever of the two spellings its file holds — the MaterialX is what
 * the studio writes now, the envelope what a `.mtlx` written before the switch holds.
 *
 * Unlike the glTF kinds, the content is NOT the file's own text: the editor composes an
 * `MtlxDocument`, and the XML is this layer's spelling of it, exactly as `stack.xml` is of a
 * picture's stack.
 */
function materialDocument(body: string): DocumentFile {
  const { version, envelope } = mtlxHeadIn(body)
  if (!version) return envelopedDocument(body)

  return { ...mtlxEnvelope(envelope), content: JSON.stringify(readMaterialX(body)) }
}

/**
 * A material IS its MaterialX. The envelope rides on the root tag, which is the first line of the
 * file whatever the state weighs — so unlike a glTF this format has a real head, and a listing
 * never opens a material whole.
 */
const OPEN_MATERIALX: DocumentBodyFormat = {
  read: body => materialDocument(body.toString('utf8')),
  write: document => {
    const parsed = jsonOrNull(document.content)
    return isMtlxDocument(parsed)
      ? writeMaterialX(parsed, JSON.stringify(studioStamp({}, document)))
      : ENVELOPED.write(document)
  },
  readHead: async file => {
    const head = (await firstBytes(file, MTLX_HEAD_LIMIT)).toString('utf8')
    // A first line that PARSES as an envelope is a document written before the switch; a
    // `<?xml` declaration is not one, so the two never answer for each other.
    const cut = head.indexOf('\n')
    const first = cut === -1 ? null : jsonOrNull(head.slice(0, cut))
    if (isRecord(first)) return parseDocumentEnvelope(first)

    const { version, envelope } = mtlxHeadIn(head)
    if (!version) throw new Error('Not a MaterialX document')
    // A `.mtlx` somebody put in the project carries no attribute of ours. Turned away rather than
    // listed, which is the rule every open format here follows — `read` still rebuilds it.
    if (!envelope) throw new Error('Nothing of the studio where this file begins')
    return mtlxEnvelope(envelope)
  },
}

/**
 * An interface IS its JSON — one object, opening on the studio's own key so a listing reads a
 * bounded head whatever the tree weighs. The shape MaterialX has, and better than glTF's, whose
 * mark can fall past the read behind a long list of root nodes.
 */
const OPEN_UI: DocumentBodyFormat = {
  read: body => uiDocument(body.toString('utf8')),
  write: document => {
    const parsed = jsonOrNull(document.content)
    // 🛑 Refused, never wrapped in the envelope — the way a montage that is not one is. The two
    // formats that DO fall back have a legacy enveloped form on people's disks; this one has
    // none, so the fallback could only ever turn a valid `.ui.json` into something no other
    // tool parses. A rename reaches this writer without passing the window's own refusal.
    if (!isRecord(parsed) || !isUiFile(parsed)) {
      throw new Error('Refusing to write an interface that is not one')
    }

    // The stamp FIRST, and the document after it: written last it would sit behind the tree,
    // outside the bounded head, and the file would drop out of every listing. The `$schema` is
    // the WINDOW's — `uiPayload` puts it there — so it travels in `rest` like any other member.
    const { [STUDIO_METADATA_KEY]: held, ...rest } = parsed
    return `${JSON.stringify(
      { [STUDIO_METADATA_KEY]: studioStamp(isRecord(held) ? held : {}, document), ...rest },
      null,
      2,
    )}\n`
  },
  readHead: async file => {
    const head = (await firstBytes(file, ENVELOPE_LIMIT)).toString('utf8')
    const cut = head.indexOf('\n')
    // A first line that PARSES as an envelope is a document written before this format; an
    // indented interface has one too — it reads `{` — so the parse is what tells them apart.
    const first = cut === -1 ? null : jsonOrNull(head.slice(0, cut))
    if (isRecord(first) && !(STUDIO_METADATA_KEY in first)) return parseDocumentEnvelope(first)

    // A `.ui.json` somebody else wrote carries nothing of ours: turned away rather than listed,
    // which is the rule every open format here follows.
    if (!head.includes(STUDIO_MARK)) throw new Error('Nothing of the studio where this file begins')
    return shortHeadIn(head, 'gui') ?? uiDocument(await readFile(file, 'utf8'))
  },
}

function uiDocument(body: string): DocumentFile {
  const parsed = jsonOrNull(body)
  if (!isRecord(parsed) || !(STUDIO_METADATA_KEY in parsed)) return envelopedDocument(body)

  return openDocument(
    body,
    parsed,
    value => (isRecord(value) ? studioMetadataOf(value) : {}),
    'gui',
  )
}

/** The studio's own block of a `.ui.json`, which is a member of the object rather than an extra. */
const studioMetadataOf = (value: Record<string, unknown>): Record<string, unknown> => {
  const held = value[STUDIO_METADATA_KEY]
  return isRecord(held) ? held : {}
}

/** The one kind with NOTHING of the studio in its file, so the envelope is composed rather than
 * read: the file NAME is the id — a renamed script is a different document — and `readHead`
 * touches no disk, so listing a hundred scripts opens none of them. */
const PLAIN_TEXT: DocumentBodyFormat = {
  read: body => ({ ...plainEnvelope(), content: body.toString('utf8') }),
  write: document => document.content,
  readHead: () => Promise.resolve(plainEnvelope()),
}

const plainEnvelope = (): DocumentEnvelope => ({
  version: DOCUMENT_VERSION,
  kind: 'script',
  // Both left to the file: the stem is the title AND the id, and a value invented here would be
  // one the folder disagrees with at the next rename.
  title: '',
  updatedAt: '',
})

// `.gltf` twice over — the scene and the sky wear the same extension, so one entry serves both.
const FORMAT_BY_EXTENSION: Record<string, DocumentBodyFormat> = {
  [EXTENSIONS_BY_KIND.sequence]: OPEN_TIMELINE,
  [EXTENSIONS_BY_KIND.image]: OPEN_RASTER,
  [EXTENSIONS_BY_KIND.scene]: OPEN_SCENE,
  [EXTENSIONS_BY_KIND.material]: OPEN_MATERIALX,
  [EXTENSIONS_BY_KIND.script]: PLAIN_TEXT,
  [EXTENSIONS_BY_KIND.gui]: OPEN_UI,
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
 *
 * The mark is written into the FIRST bytes of the file, and that is not a nicety: `readHead`
 * looks for it inside `ENVELOPE_LIMIT` and turns away a file that has none. Behind the default
 * scene's list of root nodes it fell outside — a scene of about 1 900 objects at the root stopped
 * being listed at all, measured 18/08 — and hoisting the scene's own `extras` was not enough: a
 * file whose default scene is not the first one puts every scene BEFORE it in the way, which is
 * 47 886 bytes on three scenes of 5 000 nodes. So the mark rides on `asset`, which nothing can
 * push down: the order of an object's members means nothing to a glTF reader, and `asset` is the
 * one member the format requires.
 *
 * The kind rather than a flag, because it is what `descriptorOf` crosses with the extension —
 * and it can never disagree with the stamp below: both are read off the same `document`.
 */
function gltfBody(parsed: Record<string, unknown>, document: DocumentFile): string {
  const scenes: unknown[] = Array.isArray(parsed.scenes) ? parsed.scenes : []
  const at = defaultSceneIndex(parsed)
  const held = scenes[at]
  if (!isRecord(held)) return JSON.stringify(parsed)

  const { extras: heldExtras, ...restOfScene } = held

  const body: Record<string, unknown> = {
    asset: markedAsset(parsed.asset, document),
    scene: parsed.scene,
    scenes: scenes.map((other, index) =>
      index === at
        ? {
            extras: studioExtrasFirst(
              heldExtras,
              studioStamp(gltfStudioMetadata(parsed), document),
            ),
            ...restOfScene,
            ...(document.title ? { name: document.title } : {}),
          }
        : other,
    ),
  }
  // `Object.hasOwn` rather than `in`: the latter walks the prototype chain, so a root member
  // named `constructor` or `toString` would be dropped instead of carried through.
  for (const [key, value] of Object.entries(parsed)) {
    if (!Object.hasOwn(body, key)) body[key] = value
  }

  return JSON.stringify(body)
}

/**
 * Extras with the studio's own first, and whatever another application left there after. The copy
 * SKIPS a `scenario` the file arrived with, or the spread would put back the stamp this writes.
 * The order itself decides nothing since `markedAsset` marks `asset` — a mutation that puts ours
 * last leaves the whole suite green, measured 18/08.
 */
function studioExtrasFirst(held: unknown, studio: unknown): Record<string, unknown> {
  const extras: Record<string, unknown> = { [STUDIO_METADATA_KEY]: studio }

  for (const [key, value] of Object.entries(isRecord(held) ? held : {})) {
    if (key !== STUDIO_METADATA_KEY) extras[key] = value
  }

  return extras
}

/**
 * The `asset` member, carrying which document the file IS. `asset` is the one member glTF requires
 * and the first `gltfBody` writes, so this mark is inside the bounded head whatever the scene
 * weighs — the default scene's own block carries the state beside it and a large one does not fit.
 */
function markedAsset(held: unknown, document: DocumentFile): Record<string, unknown> {
  return {
    ...(isRecord(held) ? held : {}),
    extras: studioExtrasFirst(isRecord(held) ? held.extras : undefined, studioStamp({}, document)),
  }
}

/** A montage as OpenTimelineIO holds it, `.otio` serving two kinds and the file saying which. */
function otioDocument(body: string): DocumentFile {
  const parsed: unknown = JSON.parse(body)
  if (!isOtioTimeline(parsed)) throw new Error('Not an OpenTimelineIO timeline')

  return openDocument(body, parsed, otioStudioMetadata, 'sequence')
}
