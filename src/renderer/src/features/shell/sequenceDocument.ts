import type { Asset } from '@shared/domain/asset'
import { DOCUMENT_ID_KEY, type DocumentDescriptor } from '@shared/domain/document'
import { otioStudioMetadata, type OtioTimeline } from '@shared/domain/otio'
import i18next from 'i18next'
import { documentFolder } from '@/features/shell/documentFolder'
import { mediaLinkFrom, mediaLinkOf, mediaNameOf } from '@/engines/timeline/mediaLink'
import {
  montageHoldsMore,
  otioTimelineOf,
  readSequenceFromOtio,
  STUDIO_COMPOSED_KEYS,
  type OtioSource,
} from '@/engines/timeline/otioTimeline'
import type { Clip, SequenceState } from '@/engines/timeline/timelineState'
import { assetIdForLink } from '@/helpers/assetIndex'
import { reportNotice } from '@/services/diagnostics'
import { assetsById, useAssets } from '@/stores/assets'
import { documentIsKnown, useDocuments } from '@/stores/documents'

/** A montage to and from its file: the OpenTimelineIO one IS the document, not an export beside. */

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
 * `identifies` is the document's own save ALONE: a copy inside the project would steal its tab.
 */
export function otioTimelineFor(
  state: SequenceState,
  documentId: string,
  {
    linkOf,
    identifies = false,
    studio,
  }: {
    linkOf: (assetPath: string) => string
    identifies?: boolean
    studio?: Record<string, unknown>
  },
  // `OtioTimeline` rather than `unknown`: `otioTimelineOf` has always answered one, and a bundle
  // has to walk the tracks to rewrite what they point at.
): OtioTimeline {
  const { documents } = useDocuments.getState()
  const catalogue: Catalogue = { assets: assetsById(useAssets.getState()), documents, linkOf }

  return otioTimelineOf(state, {
    name: documents[documentId]?.title ?? documentId,
    ...(identifies ? { documentId } : {}),
    studio,
    sourceOf: clip => sourceOf(clip, catalogue),
  })
}

/** `studio` is what the WORKSPACE adds under the studio domain — see `OtioWriteOptions`. */
export function sequencePayload(
  state: SequenceState,
  documentId: string,
  studio?: Record<string, unknown>,
): unknown {
  // Read once, not once per clip: `linkOf` is called for every clip that draws from a file.
  const folder = documentFolder(documentId)

  return otioTimelineFor(state, documentId, {
    linkOf: path => mediaLinkOf(path, folder),
    identifies: true,
    // What the file carried and this editor does not compose, under what the caller adds: a take
    // saved from the Audio workspace writes its own chain, and must not be given back a stale one.
    studio: { ...carried.get(documentId), ...studio },
  })
}

/**
 * Montages that opened with LESS than their file holds: writing one back deletes the rest for good.
 */
const incomplete = new Set<string>()

/** Montages whose file holds work this editor does not compose — a marker, an effect, a transition. */
const holdsMore = new Set<string>()

/**
 * The sentence a refusal says, or `null`. Lost media first — it is the one a user can act on.
 */
export function montageIsIncomplete(documentId: string): string | null {
  if (incomplete.has(documentId)) return i18next.t('documents.saveRefusedIncomplete')
  return holdsMore.has(documentId) ? i18next.t('documents.saveRefusedMontageHoldsMore') : null
}

/** Indented: a montage IS its `.otio`, and that file is read by hand and by other tools. */
export function serializeSequencePayload(payload: unknown): string {
  return JSON.stringify(payload, null, 2)
}

/**
 * Studio metadata this editor does not compose back — carried, or a take loses its effects chain.
 */
const carried = new Map<string, Record<string, unknown>>()

const COMPOSED = new Set([DOCUMENT_ID_KEY, ...STUDIO_COMPOSED_KEYS])

function remember(payload: unknown, documentId: string): void {
  const kept = Object.entries(otioStudioMetadata(payload)).filter(([key]) => !COMPOSED.has(key))
  if (kept.length > 0) carried.set(documentId, Object.fromEntries(kept))
  else carried.delete(documentId)
}

/** Dropped with the document, so a reopened id never inherits what another file carried. */
export const forgetCarriedMetadata = (documentId: string): void => {
  carried.delete(documentId)
  holdsMore.delete(documentId)
}

/**
 * A montage read off its file. What is not a timeline opens empty, and no save writes over it.
 */
export function sequenceFromPayload(
  payload: unknown,
  documentId: string,
  /**
   * Where a bundle's unpacked media are named, keyed by the entry it rewrote each `target_url` to.
   */
  unpacked?: ReadonlyMap<string, string>,
): SequenceState {
  incomplete.delete(documentId)
  holdsMore.delete(documentId)
  remember(payload, documentId)

  const beyond = montageHoldsMore(payload)
  if (beyond.length > 0) {
    holdsMore.add(documentId)
    reportNotice(
      'document.load',
      i18next.t('documents.montageHoldsMore', { parts: beyond.join(', ') }),
    )
  }

  const unlinked: string[] = []
  const folder = documentFolder(documentId)
  const documents = useDocuments.getState()

  const { state, dropped } = readSequenceFromOtio(payload, ({ assetId, sceneId, targetUrl }) => {
    // « Does THIS project hold that id », never « where did the file come from ». A flag answering
    // the second dropped every scene clip of a bundle this very machine had exported, while the
    // scenes it named sat in the same project.
    if (sceneId) {
      return documentIsKnown(documents, sceneId)
        ? { assetId: '', sceneId }
        : { assetId: '', sceneId: '' }
    }
    // A bundle rewrote every url to its own entry and its ids were minted by another catalogue, so
    // there the url names the medium and the carried id names a row nobody here has. Read off what
    // the caller HANDED OVER rather than off a provenance label — and the catalogue is not asked
    // either way: a montage opens before the shelf has read it, and a clip dropped for a row that
    // was merely late is a cut that opens short.
    if (assetId && !unpacked) return { assetId, sceneId: '' }

    const link = mediaLinkFrom(targetUrl)
    const found = unpacked?.get(targetUrl) ?? assetIdForLink(link, folder)
    if (!found && mediaNameOf(link) !== '') unlinked.push(mediaNameOf(link))
    return { assetId: found, sceneId: '' }
  })

  // The COUNT comes from the reader, which is the only side that knows a clip was let go of and
  // for which of the three reasons; the names come from whoever could put one to it. Said rather
  // than swallowed, and the save is refused with it: a cut that silently opens shorter than it
  // was written — then overwrites the file on the next ⌘S — is the worst answer available.
  if (dropped.length > 0) {
    incomplete.add(documentId)
    reportNotice(
      'document.load',
      i18next.t('documents.unlinkedClips', {
        count: dropped.length,
        files: [...new Set([...unlinked, ...dropped].filter(Boolean))].join(', '),
      }),
    )
  }
  return state
}
