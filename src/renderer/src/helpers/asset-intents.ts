import {
  ASSET_TYPES,
  isLocalPicture,
  PICTURES,
  type Asset,
  type AssetType,
} from '@shared/domain/asset'
import type { DocumentDescriptor, DocumentKind } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import { openDocument } from '@/app/dockview-api'
import { restoreDocument } from '@/app/document-io'
import { loadTake } from '@/spaces/audio/load-take'
import { placeAsset } from '@/spaces/image/place-asset'
import { placeTextureChannel } from '@/spaces/textures/place-channel'
import { activeKind, documentOfKind, useDocuments } from '@/stores/documents'
import { addModelTo } from '@/stores/scenes'
import { addAssetToSequence, sequenceTakes } from '@/stores/sequences'
import { setSkyboxSource } from '@/stores/skyboxes'

/**
 * Where an asset can be sent, as something one can list rather than something one falls through.
 *
 * This used to be a cascade of `if`s inside `openAsset`, which worked for double-clicking and
 * for nothing else: a menu can only offer what it can enumerate. Same table, two consumers — the
 * double-click takes one entry, and the context menu lists them all.
 *
 * ORDER IS THE CASCADE, and the tab in front comes before it: a double-click lands where the
 * user is looking whenever that tab takes the asset, and the order of this table only decides
 * between the destinations they are NOT looking at.
 */
export type AssetIntent = {
  id: string
  /** Where this destination lives — the menu reads its glyph off the workspace table. */
  workspace: WorkspaceId
  /** The document it writes into. What decides whether the tab in front is this destination. */
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
   * It takes the asset where `accepts` cannot, because a double-click and a menu both hold it.
   * A `ready` that only counted open tabs would stop the cascade on a destination that then
   * refuses in silence — a cloud picture landing nowhere instead of on the montage.
   */
  ready: (asset: Asset) => boolean
  /** Resolves once the asset has landed — a destination may have to read its file first. */
  run: (asset: Asset) => Promise<void>
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
 */
function inDocument(
  kind: DocumentKind,
  put: (documentId: string, asset: Asset) => void,
  eligible: (asset: Asset, documentId: string) => boolean = () => true,
): Pick<AssetIntent, 'kind' | 'ready' | 'run'> {
  return {
    kind,
    ready: asset => {
      const target = targetOf(kind)
      return target !== null && eligible(asset, target.id)
    },
    run: async asset => {
      const target = targetOf(kind)
      if (!target) return

      // Brought forward before it is written into: an asset landing in a tab nobody is looking
      // at is indistinguishable from a double-click that did nothing.
      openDocument(target)

      // And its file read before anything is written into it. A tab that has never been on
      // screen holds no state, and writing into it makes `restoreDocument` take it for one
      // already loaded: the file is then never read, and the next save writes this over it.
      await restoreDocument(target.id)
      put(target.id, asset)
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
    ...inDocument('sequence', addAssetToSequence, (asset, documentId) =>
      sequenceTakes(documentId, asset),
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
 * What a double-click does: the destination of the tab in front when it takes the asset, and
 * otherwise the first of the table that has somewhere to put it.
 *
 * The tab in front comes first because it is the one being looked at — the cascade only ever
 * decides between destinations the user is NOT watching, which is what it did when every
 * destination but the front one was out of reach.
 */
export function defaultIntent(asset: Asset): AssetIntent | null {
  const applicable = ASSET_INTENTS.filter(
    intent => intent.accepts.includes(asset.type) && intent.ready(asset),
  )
  const front = activeKind(useDocuments.getState())

  return applicable.find(intent => intent.kind === front) ?? applicable[0] ?? null
}
