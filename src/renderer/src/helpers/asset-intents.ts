import {
  ASSET_TYPES,
  isLocalPicture,
  PICTURES,
  type Asset,
  type AssetType,
} from '@shared/domain/asset'
import { workspaceOfType } from '@shared/domain/asset-kind'
import type { DocumentDescriptor, DocumentKind } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import { openDocument } from '@/app/dockview-api'
import { restoreDocument } from '@/app/document-io'
import { loadTake } from '@/spaces/audio/load-take'
import { placeAsset } from '@/spaces/image/place-asset'
import { placeTextureChannel } from '@/spaces/textures/place-channel'
import { documentOfKind, useDocuments } from '@/stores/documents'
import { addModelTo } from '@/stores/scenes'
import { addAssetToSequence, sequenceTakes } from '@/stores/sequences'
import { setSkyboxSource } from '@/stores/skyboxes'

/**
 * Where an asset can be sent, as something one can list rather than something one falls through.
 *
 * This used to be a cascade of `if`s inside `openAsset`, which worked for double-clicking and
 * for nothing else: a menu can only offer what it can enumerate.
 *
 * There is no cascade left to fall down. A double-click opens the asset in its own space —
 * `editorIntent`, one entry, no arbitration — and this table is what the context menu lists and
 * what a drop lands in. Its ORDER is therefore the menu's, which is why the montage sits near
 * the end: the destination that takes every kind reads last.
 */
export type AssetIntent = {
  id: string
  /** Where this destination lives — the menu reads its glyph off the workspace table. */
  workspace: WorkspaceId
  /** The document it writes into — which is what `ready` looks for among the open tabs. */
  kind: DocumentKind
  labelKey: string
  /**
   * The kinds this destination takes, judged on the type alone and never on the asset.
   *
   * The platform forces it: during a drag, `dataTransfer.getData()` answers an empty string, so
   * a target knows the kind flying over it and nothing else.
   */
  accepts: readonly AssetType[]
  /**
   * Whether THIS asset can go there right now: a document of that kind must be open somewhere —
   * in front or not — and the destination must be able to take that particular asset.
   *
   * It takes the asset where `accepts` cannot, because the menu holds one and the drag the
   * other. A `ready` that only counted open tabs would offer a row that then refuses in
   * silence — a cloud picture greyed in nowhere, and enabled everywhere it cannot land.
   */
  ready: (asset: Asset) => boolean
  /**
   * Whether this destination could take the asset at all, with no document in the question.
   *
   * What `ready` cannot answer for a tab that does not exist yet: opening an asset makes its
   * document, and making one for an asset the editor then refuses leaves an empty tab where a
   * refusal belonged.
   */
  takes: (asset: Asset) => boolean
  /** Resolves once the asset has landed — a destination may have to read its file first. */
  run: (asset: Asset) => Promise<void>
  /**
   * The same landing, into a named document rather than into whichever one is open.
   *
   * What lets a double-click open an asset in a document it has just made: `run` can only ever
   * find an existing tab, and the tab that edits an asset does not exist until it is asked for.
   */
  into: (documentId: string, asset: Asset) => Promise<void>
}

/**
 * The tab this destination would write into.
 *
 * Reading the tab in FRONT is what kept an asset from crossing workspaces — a double-click
 * could only ever land on the tab already on screen, and did nothing at all from anywhere else.
 * The explorer has always crossed; this is the same promise for an asset.
 */
function targetOf(kind: DocumentKind): DocumentDescriptor | null {
  return documentOfKind(useDocuments.getState(), kind)
}

/**
 * A destination that needs an open tab of its kind, and an asset it can take.
 *
 * `eligible` mirrors the guard inside `put`: every one of them refuses in silence, and the
 * cascade has to know that before it commits rather than after.
 *
 * Its document is `null` when there is none to name yet — the question opening an asset asks
 * before it makes one. A guard that reads the document answers `true` there rather than
 * refusing: a document that does not exist has nothing to refuse with, and the fresh one this
 * makes is the default its space builds.
 */
function inDocument(
  kind: DocumentKind,
  put: (documentId: string, asset: Asset) => void,
  eligible: (asset: Asset, documentId: string | null) => boolean = () => true,
): Pick<AssetIntent, 'kind' | 'ready' | 'takes' | 'run' | 'into'> {
  const into = async (documentId: string, asset: Asset): Promise<void> => {
    const target = useDocuments.getState().documents[documentId]
    if (!target) return

    // Brought forward before it is written into: an asset landing in a tab nobody is looking
    // at is indistinguishable from a double-click that did nothing.
    openDocument(target)

    // And its file read before anything is written into it. A tab that has never been on
    // screen holds no state, and writing into it makes `restoreDocument` take it for one
    // already loaded: the file is then never read, and the next save writes this over it.
    await restoreDocument(documentId)
    put(documentId, asset)
  }

  return {
    kind,
    into,
    takes: asset => eligible(asset, null),
    ready: asset => {
      const target = targetOf(kind)
      return target !== null && eligible(asset, target.id)
    },
    run: async asset => {
      const target = targetOf(kind)
      if (target) await into(target.id, asset)
    },
  }
}

export const ASSET_INTENTS: readonly AssetIntent[] = [
  {
    id: 'skyboxes.source',
    workspace: 'skyboxes',
    labelKey: 'intents.skyboxSource',
    accepts: PICTURES,
    ...inDocument('skybox', setSkyboxSource, isLocalPicture),
  },
  {
    id: '3d.mesh',
    workspace: '3d',
    labelKey: 'intents.sceneMesh',
    accepts: ['mesh'],
    ...inDocument('scene', addModelTo),
  },
  {
    id: 'audio.take',
    workspace: 'audio',
    labelKey: 'intents.audioTake',
    accepts: ['audio'],
    ...inDocument('audio', loadTake),
  },
  {
    id: 'image.layer',
    workspace: 'image',
    labelKey: 'intents.imageLayer',
    accepts: PICTURES,
    ...inDocument('image', placeAsset, isLocalPicture),
  },
  {
    id: 'video.clip',
    workspace: 'video',
    labelKey: 'intents.videoClip',
    // Where everything ends up, hence its place near the end and the kinds it takes.
    accepts: ASSET_TYPES,
    // The only guard that reads its document: which tracks are free is a property of the
    // montage, not of the asset. A montage yet to be made has none locked.
    ...inDocument('sequence', addAssetToSequence, (asset, documentId) =>
      documentId === null ? true : sequenceTakes(documentId, asset),
    ),
  },
  {
    id: 'textures.channel',
    workspace: 'textures',
    labelKey: 'intents.textureChannel',
    accepts: PICTURES,
    // The base colour is what a bare drop fills; a named channel comes from the slot itself.
    ...inDocument('texture', placeTextureChannel, isLocalPicture),
  },
]

/** Every destination that would take this kind, whether or not its space is open right now. */
export function intentsFor(type: AssetType): readonly AssetIntent[] {
  return ASSET_INTENTS.filter(intent => intent.accepts.includes(type))
}

/**
 * Where an asset is EDITED, as opposed to where it can be sent — the destination in its own
 * space. An image is edited in Images, a mesh in 3D, a take in Audio.
 *
 * Derived from the table rather than tabulated beside it, for the reason this file already gives
 * about workspace glyphs: a second table is free to disagree with the first, and one that named
 * the wrong space would send an asset to an editor that cannot open it.
 *
 * `null` would mean a kind whose own space takes nothing of it, which no kind does today — a
 * test holds the six.
 */
export function editorIntent(asset: Asset): AssetIntent | null {
  const workspace = workspaceOfType(asset.type)
  return (
    ASSET_INTENTS.find(
      intent => intent.workspace === workspace && intent.accepts.includes(asset.type),
    ) ?? null
  )
}
