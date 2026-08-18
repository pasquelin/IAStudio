import { DOCUMENT_VERSION, type DocumentEnvelope, type DocumentFile } from '@shared/domain/document'
import { OTIO_DOCUMENT_ID, OTIO_EXTENSION, OTIO_STUDIO_KEY } from '@shared/domain/otio'
import { isRecord, readString } from '@shared/guards'
import { parseDocumentEnvelope } from './validation'

/**
 * How a document's bytes are spelt, which is not one question for every kind.
 *
 * A kind of the studio's own is an envelope on its first line and the editor's content under it.
 * A kind held in an OPEN format is that format and nothing else: no line of ours may sit in the
 * file, so what the envelope carries is read out of the standard's own metadata instead — and
 * what the standard has no field for is simply not carried.
 */

/**
 * A file read back: the envelope, and the content left as the string the editor wrote. Nothing
 * here parses an enveloped content — that is the editor's business, on its own thread.
 *
 * A file written by version 1 has no line of its own: its whole body is one object, content
 * included. It is put back into the current shape rather than refused.
 */
export function documentFrom(body: string, extension: string): DocumentFile {
  return extension === OTIO_EXTENSION ? otioDocument(body) : envelopedDocument(body)
}

/** The bytes a document is written as, read the other way round from `documentFrom`. */
export function bodyOf(document: DocumentFile, extension: string): string {
  // Verbatim: the window composed the whole standard file, metadata included, and anything added
  // here would be a second author of a format another application reads.
  if (extension === OTIO_EXTENSION) return document.content

  const { content, ...envelope } = document
  return `${JSON.stringify(envelope)}\n${content}`
}

/**
 * Whether the head of a file is enough to describe the document in it.
 *
 * False for an open format, where the fields an envelope holds are spread through the file, so
 * the whole of it is read and parsed to list one. **Measured in `documents.bench.ts`, 2026-08-18**:
 * 0.09 ms for a montage of 50 clips, 0.92 ms for 500, 9.4 ms for 5 000 — a project of a few
 * ordinary montages stays well under the 16 ms a frame has, and several of the largest would not.
 */
export function readsWhole(extension: string): boolean {
  return extension === OTIO_EXTENSION
}

function envelopedDocument(body: string): DocumentFile {
  const cut = body.indexOf('\n')
  const head: unknown = JSON.parse(cut === -1 ? body : body.slice(0, cut))
  const envelope = parseDocumentEnvelope(head)

  if (envelope.version === 1) {
    const legacy = isRecord(head) ? head.content : undefined
    return { ...envelope, content: legacy === undefined ? '' : JSON.stringify(legacy) }
  }

  return { ...envelope, content: cut === -1 ? '' : body.slice(cut + 1) }
}

/**
 * A montage as OpenTimelineIO holds it. Two fields an envelope carries have no home here and are
 * left empty on purpose: the file NAME is the title, as it is for every document, and the disk's
 * own modification time is the only true clock — one written inside a file can never match what
 * the filesystem reports of the write that finished it.
 */
function otioDocument(body: string): DocumentFile {
  const parsed: unknown = JSON.parse(body)
  if (!isRecord(parsed) || parsed.OTIO_SCHEMA !== 'Timeline.1') {
    throw new Error('Not an OpenTimelineIO timeline')
  }

  const id = readString(studioMetadata(parsed), OTIO_DOCUMENT_ID, '')
  const envelope: DocumentEnvelope = {
    version: DOCUMENT_VERSION,
    kind: 'sequence',
    title: '',
    updatedAt: '',
    ...(id ? { id } : {}),
  }
  return { ...envelope, content: body }
}

function studioMetadata(timeline: Record<string, unknown>): Record<string, unknown> {
  const metadata = timeline.metadata
  if (!isRecord(metadata)) return {}
  const studio = metadata[OTIO_STUDIO_KEY]
  return isRecord(studio) ? studio : {}
}
