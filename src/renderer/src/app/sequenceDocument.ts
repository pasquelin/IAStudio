import type { Asset } from '@shared/domain/asset'
import { DOCUMENT_ID_KEY, type DocumentDescriptor } from '@shared/domain/document'
import { otioStudioMetadata, type OtioTimeline } from '@shared/domain/otio'
import i18next from 'i18next'
import { documentFolder } from '@/app/documentFolder'
import { mediaLinkFrom, mediaLinkOf, mediaNameOf } from '@/engines/timeline/mediaLink'
import {
  montageHoldsMore,
  otioTimelineOf,
  readSequenceFromOtio,
  type OtioAssetIdOf,
  type OtioRelink,
  type OtioSource,
} from '@/engines/timeline/otioTimeline'
import type { Clip, SequenceState } from '@/engines/timeline/timelineState'
import { assetIdForLink } from '@/helpers/assetIndex'
import { reportNotice } from '@/services/diagnostics'
import { assetsById, useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'

/**
 * A montage on its way to and from its file, which is an OpenTimelineIO one and nothing else:
 * the open format IS the document, not an export laid beside a spelling of the studio's own.
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
 * The montage as OpenTimelineIO holds it. Composed by the WINDOW: only this side holds the
 * catalogue a clip's media is resolved against.
 *
 * `identifies` writes which document the file IS, and ONLY the document's own save may ask for
 * it: an export landing inside the project would otherwise claim the id of what it copied, and
 * the listing — which settles a shared id by path order — would hand the tab to the copy.
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
 * Montages that opened holding LESS than their file did — a clip whose media nothing here could
 * be found for is dropped, and the file still holds it.
 *
 * Read by `savableDocument`: writing such a montage back would delete those clips for good, and
 * the tab shows nothing to say so, `install` having marked the document clean. The mark lifts
 * when the media are in the project and the document is opened again.
 */
const incomplete = new Set<string>()

/** Montages whose file holds work this editor does not compose — a marker, an effect, a transition. */
const holdsMore = new Set<string>()

/**
 * The sentence a refusal says, or `null` — a sky's would talk about something else entirely.
 *
 * The lost media first: it is the older of the two failures and the one a user can act on, where
 * the other asks them to give up an edit made elsewhere.
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
 * What the studio's own metadata held and this editor does not compose back — the effects chain
 * of a take, read by the Audio workspace alone, and which workspace wrote the file at all.
 *
 * Carried across a save rather than dropped, and that is what stops a take from losing its chain:
 * an `.otio` opened by the VIDEO editor — which is where one lands whose `documentKind` a foreign
 * tool stripped — would otherwise write back a montage recomposed from state alone.
 */
const carried = new Map<string, Record<string, unknown>>()

const COMPOSED = new Set([
  DOCUMENT_ID_KEY,
  'width',
  'height',
  'sampleRate',
  'playhead',
  'selectedId',
])

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
 * A montage read back off its file. `sequenceFromOtio` answers the empty sequence on anything
 * that is not a timeline, so a file the studio cannot make sense of opens on nothing rather than
 * failing — and `documentIo` refuses to write over one that did.
 */
export function sequenceFromPayload(
  payload: unknown,
  documentId: string,
  /**
   * How the clips find their media. Its default is the open project's catalogue, which is what a
   * document read off disk needs; a bundle passes the entries it just unpacked. Taken here rather
   * than read straight from `sequenceFromOtio` so that a montage arriving from ANYWHERE gets the
   * same bookkeeping — the carried metadata kept, the losses said, the save refused.
   */
  linking?: { assetIdOf: OtioAssetIdOf; relink: OtioRelink },
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
  const { state, dropped } = readSequenceFromOtio(
    payload,
    linking?.assetIdOf ??
      (url => {
        const link = mediaLinkFrom(url)
        const found = assetIdForLink(link, folder)
        // Only a link that NAMES something: a clip drawing a live scene has no media and no url,
        // and counting it here reported every scene of a montage as a file that had gone missing.
        if (!found && mediaNameOf(link) !== '') unlinked.push(mediaNameOf(link))
        return found
      }),
    linking?.relink,
  )

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
