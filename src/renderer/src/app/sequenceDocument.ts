import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { FOLDER_ROOT, nameOf, parentOf } from '@shared/domain/folder'
import i18next from 'i18next'
import {
  mediaLinkFrom,
  mediaLinkOf,
  mediaNameOf,
  mediaPathOf,
  relinkedBySuffix,
  type MediaLink,
} from '@/engines/timeline/mediaLink'
import { otioTimelineOf, sequenceFromOtio, type OtioSource } from '@/engines/timeline/otioTimeline'
import type { Clip, SequenceState } from '@/engines/timeline/timelineState'
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
): unknown {
  const { documents } = useDocuments.getState()
  const catalogue: Catalogue = { assets: assetsById(useAssets.getState()), documents, linkOf }

  return otioTimelineOf(state, {
    name: documents[documentId]?.title ?? documentId,
    ...(identifies ? { documentId } : {}),
    studio,
    sourceOf: clip => sourceOf(clip, catalogue),
  })
}

/** The folder a document's media links are relative to — its own, so a project stays movable. */
function heldIn(documentId: string): readonly string[] {
  const path = useDocuments.getState().documents[documentId]?.path ?? FOLDER_ROOT
  const folder = parentOf(path) ?? FOLDER_ROOT
  return folder === FOLDER_ROOT ? [] : folder.split('/')
}

/** `studio` is what the WORKSPACE adds under the studio domain — see `OtioWriteOptions`. */
export function sequencePayload(
  state: SequenceState,
  documentId: string,
  studio?: Record<string, unknown>,
): unknown {
  // Read once, not once per clip: `linkOf` is called for every clip that draws from a file.
  const folder = heldIn(documentId)

  return otioTimelineFor(state, documentId, {
    linkOf: path => mediaLinkOf(path, folder),
    identifies: true,
    studio,
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

export const montageIsIncomplete = (documentId: string): boolean => incomplete.has(documentId)

/** Indented: a montage IS its `.otio`, and that file is read by hand and by other tools. */
export function serializeSequencePayload(payload: unknown): string {
  return JSON.stringify(payload, null, 2)
}

/**
 * A montage read back off its file. `sequenceFromOtio` answers the empty sequence on anything
 * that is not a timeline, so a file the studio cannot make sense of opens on nothing rather than
 * failing — and `documentIo` refuses to write over one that did.
 */
export function sequenceFromPayload(payload: unknown, documentId: string): SequenceState {
  incomplete.delete(documentId)

  const unlinked: string[] = []
  const relink = assetIdRelinker(heldIn(documentId))
  const state = sequenceFromOtio(payload, url => {
    const link = mediaLinkFrom(url)
    const found = relink(link)
    // Only a link that NAMES something: a clip drawing a live scene has no media and no url, and
    // counting it here reported every scene of a montage as a file that had gone missing.
    if (!found && mediaNameOf(link) !== '') unlinked.push(mediaNameOf(link))
    return found
  })

  // Said rather than swallowed, and the save is refused with it: a clip nothing could be found
  // for is DROPPED, and a cut that silently opens shorter than it was written — then overwrites
  // the file on the next ⌘S — is the worst answer available.
  if (unlinked.length > 0) {
    incomplete.add(documentId)
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
 * Turns a media a file names by path into a line of the catalogue — only ever asked for a clip
 * the studio's own metadata does not name, which means a file written by another application.
 *
 * **The blind spot, written rather than hidden**: this reads `assetsById`, which holds every
 * asset this window has been SHOWN, not the whole catalogue. A media whose row has never been
 * listed here answers nothing and its clip is dropped — said out loud, but dropped. Asking the
 * catalogue by path (`helpers/assetAt`) is a round trip, and `DocumentIo.install` is synchronous.
 */
function assetIdRelinker(documentFolder: readonly string[]): (link: MediaLink) => string {
  const { byPath, byName } = assetIndex()

  return link => {
    const path = mediaPathOf(link, documentFolder)
    return (
      (path === null ? undefined : byPath.get(path)) ??
      relinkedBySuffix(link, byPath) ??
      byName.get(mediaNameOf(link)) ??
      ''
    )
  }
}

type AssetIndex = { byPath: ReadonlyMap<string, string>; byName: ReadonlyMap<string, string> }

let indexed: { of: ReadonlyMap<string, Asset>; index: AssetIndex } | null = null

/**
 * The catalogue turned the two ways a link resolves, built once per catalogue rather than once
 * per document opened: every montage opened in a session walked every asset the window had been
 * shown, and that set only grows.
 *
 * Keyed on the map's identity, which `assetsById` already memoises on the asset list — so this
 * rebuilds exactly when the catalogue changes, and never otherwise.
 */
function assetIndex(): AssetIndex {
  const assets = assetsById(useAssets.getState())
  if (indexed?.of === assets) return indexed.index

  const byPath = new Map<string, string>()
  const byName = new Map<string, string>()
  for (const asset of assets.values()) {
    if (!asset.path) continue
    byPath.set(asset.path, asset.id)
    // First in wins: two folders may hold a `rush.mp4`, and answering the last read would make
    // the link depend on the order the catalogue happened to come back in.
    if (!byName.has(nameOf(asset.path))) byName.set(nameOf(asset.path), asset.id)
  }

  indexed = { of: assets, index: { byPath, byName } }
  return indexed.index
}
