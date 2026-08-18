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

const FORMAT_BY_EXTENSION: Record<string, DocumentBodyFormat> = {
  [EXTENSIONS_BY_KIND.sequence]: OPEN_TIMELINE,
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
