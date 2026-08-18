import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { extensionOf } from '@shared/domain/fileName'
import { nameOf, parentOf } from '@shared/domain/folder'
import { OTIO_EXTENSION } from '@shared/domain/otio'
import { isRecord } from '@shared/guards'
import i18next from 'i18next'
import {
  mediaLinkOf,
  mediaNameOf,
  mediaPathOf,
  relinkedBySuffix,
} from '@/engines/timeline/mediaLink'
import { otioTimelineOf, sequenceFromOtio, type OtioSource } from '@/engines/timeline/otioTimeline'
import { parseSequence, type Clip, type SequenceState } from '@/engines/timeline/timelineState'
import { reportNotice } from '@/services/diagnostics'
import { assetsById, useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'

/**
 * A montage on its way to and from its file.
 *
 * Which spelling it is WRITTEN in is the file's, not the kind's: a project holds montages saved
 * before the studio spoke OpenTimelineIO. What is READ is decided by the payload itself — a file
 * renamed by hand must open as what it holds, not as what its name claims.
 */

/** Everything a clip is named and pointed at from, read once for a whole montage. */
type Catalogue = {
  assets: ReadonlyMap<string, Asset>
  documents: Record<string, DocumentDescriptor>
  linkOf: (assetPath: string) => string
}

function sourceOf(clip: Clip, { assets, documents, linkOf }: Catalogue): OtioSource {
  if (clip.sceneId) {
    // No url whatever we answer — a scene is rendered, not read — but the NAME is what another
    // application shows in place of the missing picture.
    return { name: documents[clip.sceneId]?.title ?? clip.sceneId, url: null }
  }

  const asset = assets.get(clip.assetId)
  return { name: asset?.name ?? clip.assetId, url: asset?.path ? linkOf(asset.path) : null }
}

/**
 * The montage as OpenTimelineIO holds it, media pointed at from the montage's own folder.
 *
 * Composed by the WINDOW: only this side holds the catalogue a clip's media is resolved against,
 * and the main process would have nothing to turn an asset id into a path with.
 *
 * `linkOf` is how a media is pointed at — relative for the document, which is what makes a
 * project movable, and absolute for an export that lands outside it.
 */
export function otioTimelineFor(
  state: SequenceState,
  documentId: string,
  linkOf: (assetPath: string) => string,
): unknown {
  const { documents } = useDocuments.getState()
  const catalogue: Catalogue = { assets: assetsById(useAssets.getState()), documents, linkOf }

  return otioTimelineOf(state, {
    name: documents[documentId]?.title ?? documentId,
    documentId,
    sourceOf: clip => sourceOf(clip, catalogue),
  })
}

/** Where a document's own file sits, which is what its media links are relative to. */
const folderOf = (documentId: string): string =>
  parentOf(useDocuments.getState().documents[documentId]?.path ?? '') ?? ''

/** Whether this document's own file is the standard one, which is what a save has to write. */
function heldAsOtio(documentId: string): boolean {
  const path = useDocuments.getState().documents[documentId]?.path
  return path !== undefined && extensionOf(nameOf(path)) === OTIO_EXTENSION
}

export function sequencePayload(state: SequenceState, documentId: string): unknown {
  if (!heldAsOtio(documentId)) return state

  const folder = folderOf(documentId)
  return otioTimelineFor(state, documentId, path => mediaLinkOf(path, folder))
}

/**
 * Indented for the open format and not for the studio's own: a `.otio` is read by hand and by
 * other tools, and it is written exactly as an export of it would be.
 */
export function serializeSequencePayload(payload: unknown): string {
  return isOtioTimeline(payload) ? JSON.stringify(payload, null, 2) : JSON.stringify(payload)
}

const isOtioTimeline = (payload: unknown): boolean =>
  isRecord(payload) && payload.OTIO_SCHEMA === 'Timeline.1'

/**
 * A montage read back, whichever of the two spellings its file holds.
 *
 * Read off the payload rather than off the extension: a `.seq` holding a standard timeline — one
 * renamed by hand, or written by a build that had already turned over — must open as what it is.
 */
export function sequenceFromPayload(payload: unknown, documentId: string): SequenceState {
  if (!isOtioTimeline(payload)) return parseSequence(payload)

  const unlinked: string[] = []
  const relink = assetIdRelinker(folderOf(documentId))
  const state = sequenceFromOtio(payload, url => {
    const found = relink(url)
    if (!found) unlinked.push(mediaNameOf(url))
    return found
  })

  // Said rather than swallowed: a clip nothing could be found for is DROPPED, and a cut that
  // silently opens shorter than it was written is the worst answer available.
  if (unlinked.length > 0) {
    reportNotice(
      'document.load',
      i18next.t('documents.unlinkedClips', {
        count: unlinked.length,
        files: [...new Set(unlinked)].join(', '),
      }),
    )
  }
  return state
}

/**
 * Turns a media a file names by path into a line of the catalogue.
 *
 * Only ever consulted for a clip the studio's own metadata does not name — a file written by
 * another application. By path first, then by the longest tail of an absolute one, then by file
 * name. Never a guess beyond that: an empty answer drops the clip, which is said out loud, where
 * a wrong one would play the wrong picture and say nothing.
 */
function assetIdRelinker(documentFolder: string): (targetUrl: string) => string {
  const byPath = new Map<string, string>()
  const byName = new Map<string, string>()

  for (const asset of useAssets.getState().items) {
    if (!asset.path) continue
    byPath.set(asset.path, asset.id)
    // First in wins: two folders may hold a `rush.mp4`, and answering the last read would make
    // the link depend on the order the catalogue happened to come back in.
    if (!byName.has(nameOf(asset.path))) byName.set(nameOf(asset.path), asset.id)
  }

  return targetUrl => {
    const path = mediaPathOf(targetUrl, documentFolder)
    const here = path === null ? undefined : byPath.get(path)
    return here ?? relinkedBySuffix(targetUrl, byPath) ?? byName.get(mediaNameOf(targetUrl)) ?? ''
  }
}
