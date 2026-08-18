import { open, readFile } from 'node:fs/promises'
import {
  DOCUMENT_VERSION,
  ENVELOPE_LIMIT,
  EXTENSIONS_BY_KIND,
  type DocumentEnvelope,
  type DocumentFile,
} from '@shared/domain/document'
import {
  isOtioTimeline,
  otioStudioMetadata,
  OTIO_DOCUMENT_ID,
  OTIO_DOCUMENT_KIND,
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
  /**
   * Whether the FILE says which kind it is, rather than its extension. True only where one
   * extension serves two kinds, and it reverses the usual rule that the folder's word beats the
   * file's — there being no word in the folder to beat.
   */
  kindFromHead?: boolean
}

/** The one every kind the studio invented is written in, and the one a listing reads short. */
export const ENVELOPED: DocumentBodyFormat = {
  read: envelopedDocument,
  write: document => {
    const { content, ...envelope } = document
    return `${JSON.stringify(envelope)}\n${content}`
  },
  readHead: async file => {
    const handle = await open(file, 'r')
    try {
      const buffer = Buffer.alloc(ENVELOPE_LIMIT)
      const { bytesRead } = await handle.read(buffer, 0, ENVELOPE_LIMIT, 0)
      const head = buffer.toString('utf8', 0, bytesRead)
      const cut = head.indexOf('\n')
      if (cut !== -1) return parseDocumentEnvelope(JSON.parse(head.slice(0, cut)))
    } finally {
      await handle.close()
    }

    // A version 1 file has no line of its own, so its head is truncated and fails to parse.
    return envelopedDocument(await readFile(file, 'utf8'))
  },
}

const OPEN_TIMELINE: DocumentBodyFormat = {
  read: otioDocument,
  write: otioBody,
  // No head of ours to read short: what an envelope carries is spread through the file, so the
  // whole of it is read and parsed. `documents.bench.ts` is what says at which size that hurts.
  readHead: async file => otioDocument(await readFile(file, 'utf8')),
  kindFromHead: true,
}

/**
 * The scene and the sky, which share `.gltf`: the envelope already carries the kind, so the file
 * answering for itself costs nothing here. **The bytes under it are still the studio's own** —
 * what makes this a glTF is not written yet, and no other application opens one of these.
 */
const OPEN_SCENE: DocumentBodyFormat = { ...ENVELOPED, kindFromHead: true }

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
 * The name is stamped from the title so a RENAME reaches the field another application shows.
 */
function otioBody(document: DocumentFile): string {
  const parsed: unknown = JSON.parse(document.content)
  if (!isOtioTimeline(parsed)) throw new Error('Refusing to write a montage that is not one')

  return JSON.stringify(document.title ? { ...parsed, name: document.title } : parsed, null, 2)
}

/**
 * A montage as OpenTimelineIO holds it. Title and clock are left empty on purpose: the file NAME
 * is the title, as it is for every document, and the disk's own modification time is the only
 * true clock — one written inside a file can never match the write that finished it.
 *
 * The kind comes from the file rather than from its name: the video montage and the audio one are
 * the same standard file, so `.otio` cannot tell them apart and only the metadata can.
 */
function otioDocument(body: string): DocumentFile {
  const parsed: unknown = JSON.parse(body)
  if (!isOtioTimeline(parsed)) throw new Error('Not an OpenTimelineIO timeline')

  const studio = otioStudioMetadata(parsed)
  const id = readString(studio, OTIO_DOCUMENT_ID, '')
  return {
    version: DOCUMENT_VERSION,
    kind: readString(studio, OTIO_DOCUMENT_KIND, '') === 'audio' ? 'audio' : 'sequence',
    title: '',
    updatedAt: '',
    ...(id ? { id } : {}),
    content: body,
  }
}
