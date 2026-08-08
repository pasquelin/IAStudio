import {
  mdiCubeOutline,
  mdiImageOutline,
  mdiPanoramaVariantOutline,
  mdiTextureBox,
  mdiVideoOutline,
  mdiVolumeHigh,
} from '@mdi/js'
import { isLocalPicture, PICTURES, type Asset, type AssetType } from '@shared/domain/asset'
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
 * for nothing else: a menu can only offer what it can enumerate, and a drop target can only
 * refuse what it can name. Same table, three consumers — the double-click takes the first
 * applicable entry, the context menu lists them all, and a drop target picks one by id.
 *
 * ORDER IS THE CASCADE. The first entry whose space is open and whose `accepts` says yes is what
 * a double-click does, exactly as the chain of `if`s did before it.
 */
export type AssetIntent = {
  id: string
  workspace: WorkspaceId
  labelKey: string
  icon: string
  /**
   * Whether this destination takes that KIND — judged on the type alone, never on the asset.
   *
   * The platform forces it: during a drag, `dataTransfer.getData()` answers an empty string, so
   * a target knows the kind flying over it and nothing else. An `accepts` that needed the whole
   * asset could not be asked in time to paint the target.
   */
  accepts: (type: AssetType) => boolean
  /** Whether there is somewhere to put it right now — the space must have a document open. */
  ready: () => boolean
  run: (asset: Asset) => void
}

function activeId(kind: Parameters<typeof activeIdOfKind>[1]): string | null {
  return activeIdOfKind(useDocuments.getState(), kind)
}

export const ASSET_INTENTS: readonly AssetIntent[] = [
  {
    id: 'skyboxes.source',
    workspace: 'skyboxes',
    labelKey: 'intents.skyboxSource',
    icon: mdiPanoramaVariantOutline,
    accepts: type => PICTURES.includes(type),
    ready: () => activeId('skybox') !== null,
    run: asset => {
      const tab = activeId('skybox')
      if (tab) setSkyboxSource(tab, asset)
    },
  },
  {
    id: '3d.mesh',
    workspace: '3d',
    labelKey: 'intents.sceneMesh',
    icon: mdiCubeOutline,
    accepts: type => type === 'mesh',
    ready: () => activeId('scene') !== null,
    run: asset => {
      const tab = activeId('scene')
      if (tab) addModelTo(tab, asset)
    },
  },
  {
    id: 'audio.take',
    workspace: 'audio',
    labelKey: 'intents.audioTake',
    icon: mdiVolumeHigh,
    accepts: type => type === 'audio',
    ready: () => activeId('audio') !== null,
    run: asset => {
      const tab = activeId('audio')
      if (tab) loadTake(tab, asset)
    },
  },
  {
    id: 'image.layer',
    workspace: 'image',
    labelKey: 'intents.imageLayer',
    icon: mdiImageOutline,
    accepts: type => PICTURES.includes(type),
    ready: () => activeId('image') !== null,
    run: asset => {
      const tab = activeId('image')
      // A cloud asset has no file to decode yet; the shelf offers to fetch it instead.
      if (tab && isLocalPicture(asset)) placeAsset(tab, asset)
    },
  },
  {
    id: 'video.clip',
    workspace: 'video',
    labelKey: 'intents.videoClip',
    icon: mdiVideoOutline,
    // The montage is where everything ends up, which is why it closes the cascade.
    accepts: () => true,
    ready: () => true,
    run: asset => addAssetToSequence(asset),
  },
  {
    id: 'textures.channel',
    workspace: 'textures',
    labelKey: 'intents.textureChannel',
    icon: mdiTextureBox,
    accepts: type => PICTURES.includes(type),
    ready: () => activeId('texture') !== null,
    run: asset => {
      const tab = activeId('texture')
      // The base colour is what a bare drop fills; a named channel comes from the slot itself.
      if (tab) placeTextureChannel(tab, asset)
    },
  },
]

/** Every destination that would take this kind, whether or not its space is open right now. */
export function intentsFor(type: AssetType): readonly AssetIntent[] {
  return ASSET_INTENTS.filter(intent => intent.accepts(type))
}

export function intentAt(id: string): AssetIntent | null {
  return ASSET_INTENTS.find(intent => intent.id === id) ?? null
}

/**
 * What a double-click does: the first destination that would take it and has somewhere to put
 * it. Identical to the chain of `if`s this replaced, because the order of the table IS that
 * chain — the difference is that it can now be listed and pointed at.
 */
export function defaultIntent(asset: Asset): AssetIntent | null {
  return ASSET_INTENTS.find(intent => intent.accepts(asset.type) && intent.ready()) ?? null
}
