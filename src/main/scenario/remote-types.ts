import type { AssetType } from '@shared/domain/asset'
import type { RemoteAssetType } from './asset-catalog'

/**
 * Which `metadata.type` values stand for each of our six kinds, for the ONE filter the API
 * offers natively: `GET /assets?types=`.
 *
 * It runs this way round — ours to theirs — because that is the direction a query travels.
 * Reading an asset back goes the other way, through `assetTypeOfRemote`, and the two are not
 * inverses: eighty values collapse into six, and a value this build has never heard of must
 * still land somewhere on the way in.
 *
 * `image` is deliberately absent. It is the residue — everything that is not a material, a sky,
 * a mesh, a take or a clip — and listing its forty-odd values would mean a filter that silently
 * drops every new one the API invents. Asking for pictures asks for no filter at all, and the
 * kinds are told apart once the answers are read.
 */
const REMOTE_TYPES: Partial<Record<AssetType, readonly RemoteAssetType[]>> = {
  texture: [
    'texture',
    'texture-albedo',
    'texture-normal',
    'texture-height',
    'texture-metallic',
    'texture-smoothness',
    'texture-ao',
    'texture-edge',
    'upscale-texture',
    '3d-texture',
    '3d-texture-albedo',
    '3d-texture-normal',
    '3d-texture-roughness',
    '3d-texture-metallic',
  ],
  skybox: ['skybox-base-360', 'skybox-hdri', 'skybox-3d', 'upscale-skybox'],
  mesh: ['img23d', 'txt23d', 'video23d', '3d23d', 'img2splat', 'uploaded-3d'],
  video: ['txt2video', 'img2video', 'video2video', 'upscale-video', 'uploaded-video'],
  audio: ['txt2audio', 'audio2audio', 'voice-clone', 'uploaded-audio'],
}

/**
 * The API-side filter for a set of studio kinds, or `undefined` when none can be expressed.
 *
 * `undefined` means "ask for everything and sort it out here", which is the honest answer for
 * pictures and for any mix that includes them.
 */
export function remoteTypesFor(
  types: readonly AssetType[] | undefined,
): readonly RemoteAssetType[] | undefined {
  if (!types?.length) return undefined

  // Remove 'image' (residue type) and process the rest — images come back with everything.
  const nonImageTypes = types.filter(t => t !== 'image')
  if (nonImageTypes.length === 0) return undefined

  const wanted = nonImageTypes.flatMap(type => REMOTE_TYPES[type] ?? [])
  return wanted.length > 0 ? wanted : undefined
}
