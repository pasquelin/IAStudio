import { ASSET_TYPES, PICTURES, type Asset, type AssetType } from '@shared/domain/asset'
import type { DocumentKind } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import { loadTake } from '@/spaces/audio/load-take'
import { placeAsset } from '@/spaces/image/place-asset'
import { placeTextureChannel } from '@/spaces/textures/place-channel'
import { activeIdOfKind, useDocuments } from '@/stores/documents'
import { addModelTo } from '@/stores/scenes'
import { addAssetToSequence } from '@/stores/sequences'
import { setSkyboxSource } from '@/stores/skyboxes'

/**
 * Where an asset can be sent, as something one can list rather than something one falls through.
 *
 * This used to be a cascade of `if`s inside `openAsset`, which worked for double-clicking and
 * for nothing else: a menu can only offer what it can enumerate. Same table, two consumers — the
 * double-click takes the first applicable entry, and the context menu lists them all.
 *
 * ORDER IS THE CASCADE. The first entry whose space is open and whose `accepts` says yes is what
 * a double-click does, exactly as the chain of `if`s did before it.
 */
export type AssetIntent = {
  id: string
  /** Where this destination lives — the menu reads its glyph off the workspace table. */
  workspace: WorkspaceId
  labelKey: string
  /**
   * The kinds this destination takes, judged on the type alone and never on the asset.
   *
   * The platform forces it: during a drag, `dataTransfer.getData()` answers an empty string, so
   * a target knows the kind flying over it and nothing else.
   */
  accepts: readonly AssetType[]
  /** Whether there is somewhere to put it right now — the space must have a document open. */
  ready: () => boolean
  run: (asset: Asset) => void
}

function activeId(kind: DocumentKind): string | null {
  return activeIdOfKind(useDocuments.getState(), kind)
}

/** A destination that needs an open tab of its kind — which is every one of them but the montage. */
function inDocument(
  kind: DocumentKind,
  put: (documentId: string, asset: Asset) => void,
): Pick<AssetIntent, 'ready' | 'run'> {
  return {
    ready: () => activeId(kind) !== null,
    run: asset => {
      const tab = activeId(kind)
      if (tab) put(tab, asset)
    },
  }
}

export const ASSET_INTENTS: readonly AssetIntent[] = [
  {
    id: 'skyboxes.source',
    workspace: 'skyboxes',
    labelKey: 'intents.skyboxSource',
    accepts: PICTURES,
    ...inDocument('skybox', setSkyboxSource),
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
    ...inDocument('image', placeAsset),
  },
  {
    id: 'video.clip',
    workspace: 'video',
    labelKey: 'intents.videoClip',
    // The montage is where everything ends up, which is why it closes the cascade.
    accepts: ASSET_TYPES,
    ready: () => true,
    run: asset => addAssetToSequence(asset),
  },
  {
    id: 'textures.channel',
    workspace: 'textures',
    labelKey: 'intents.textureChannel',
    accepts: PICTURES,
    // The base colour is what a bare drop fills; a named channel comes from the slot itself.
    ...inDocument('texture', placeTextureChannel),
  },
]

/** Every destination that would take this kind, whether or not its space is open right now. */
export function intentsFor(type: AssetType): readonly AssetIntent[] {
  return ASSET_INTENTS.filter(intent => intent.accepts.includes(type))
}

/**
 * What a double-click does: the first destination that would take it and has somewhere to put
 * it. Identical to the chain of `if`s this replaced, because the order of the table IS that
 * chain — the difference is that it can now be listed and pointed at.
 */
export function defaultIntent(asset: Asset): AssetIntent | null {
  return ASSET_INTENTS.find(intent => intent.accepts.includes(asset.type) && intent.ready()) ?? null
}
