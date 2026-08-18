import { open, readFile } from 'node:fs/promises'
import {
  DOCUMENT_VERSION,
  ENVELOPE_LIMIT,
  EXTENSIONS_BY_KIND,
  isDocumentKind,
  type DocumentEnvelope,
  type DocumentFile,
} from '@shared/domain/document'
import {
  isOtioTimeline,
  otioStudioMetadata,
  OTIO_DOCUMENT_ID,
  OTIO_DOCUMENT_KIND,
  OTIO_STUDIO_KEY,
} from '@shared/domain/otio'
import { ORA_HEAD_LIMIT, ORA_MIMETYPE } from '@shared/domain/openRaster'
import { isRecord, readString } from '@shared/guards'
import {
  oraHeadIn,
  packOpenRaster,
  unpackOpenRaster,
  type OraHead,
} from '@main/assets/openRasterFile'
import { parseDocumentEnvelope, parseOraStack } from './validation'

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

/** The head of a file and no more of it — what keeps a listing from reading a project whole. */
async function firstBytes(file: string, limit: number): Promise<Buffer> {
  const handle = await open(file, 'r')
  try {
    const buffer = Buffer.alloc(limit)
    const { bytesRead } = await handle.read(buffer, 0, limit, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

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
  // No head of ours to read short: what an envelope carries is spread through the file, so the
  // whole of it is read and parsed — and handed back whole, `DocumentHead.content` being what
  // keeps an open from paying for that parse a second time.
  readHead: async file => otioDocument(await readFile(file, 'utf8')),
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
  write: document =>
    packOpenRaster(
      { stack: parseOraStack(JSON.parse(document.content)), surfaces: document.parts ?? [] },
      // The content is the caller's; the envelope is the file layer's own, exactly as the first
      // line of an enveloped document is. `parts` is left out for the same reason `content` is:
      // they are the container's own entries, and naming them twice would let the two disagree.
      JSON.stringify(oraEnvelopeOf(document)),
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

function oraEnvelopeOf(document: DocumentFile): DocumentEnvelope {
  const { content, parts, ...envelope } = document
  return envelope
}

const FORMAT_BY_EXTENSION: Record<string, DocumentBodyFormat> = {
  [EXTENSIONS_BY_KIND.sequence]: OPEN_TIMELINE,
  [EXTENSIONS_BY_KIND.image]: OPEN_RASTER,
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
        [OTIO_STUDIO_KEY]: {
          ...otioStudioMetadata(parsed),
          ...(document.id ? { [OTIO_DOCUMENT_ID]: document.id } : {}),
          [OTIO_DOCUMENT_KIND]: document.kind,
        },
      },
    },
    null,
    2,
  )
}

/**
 * A montage as OpenTimelineIO holds it. Title and clock are left empty on purpose: the file NAME
 * is the title, as it is for every document, and the disk's own modification time is the only
 * true clock — one written inside a file can never match the write that finished it.
 *
 * The kind comes from the file, `.otio` serving two of them. A timeline from another application
 * says nothing, and takes the first kind the extension names — `descriptorOf` is what refuses one
 * this extension could never be.
 */
function otioDocument(body: string): DocumentFile {
  const parsed: unknown = JSON.parse(body)
  if (!isOtioTimeline(parsed)) throw new Error('Not an OpenTimelineIO timeline')

  const studio = otioStudioMetadata(parsed)
  const id = readString(studio, OTIO_DOCUMENT_ID, '')
  const claimed = readString(studio, OTIO_DOCUMENT_KIND, '')
  return {
    version: DOCUMENT_VERSION,
    kind: isDocumentKind(claimed) ? claimed : 'sequence',
    title: '',
    updatedAt: '',
    ...(id ? { id } : {}),
    content: body,
  }
}
