import { FOLDER_ROOT, parentOf } from '@shared/domain/folder'
import type { SkyboxContent } from '@shared/domain/skybox'
import { gltfSkyOf, skyFromGltf } from '@/engines/skybox/gltfSky'
import { mediaLinkFrom, mediaLinkOf } from '@/engines/timeline/mediaLink'
import { assetIdForLink } from '@/helpers/assetIndex'
import { assetsById, useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'

/**
 * A sky on its way to and from its file, which is a glTF one and nothing else.
 *
 * Composed by the WINDOW, for the reason a montage is: only this side holds the catalogue the
 * source picture is resolved against, and the file names that picture by PATH — an id would name
 * nothing to any other application, and nothing at all in another project.
 */

/** The folder a document's links are relative to — its own, so a project stays movable. */
function heldIn(documentId: string): readonly string[] {
  const path = useDocuments.getState().documents[documentId]?.path ?? FOLDER_ROOT
  const folder = parentOf(path) ?? FOLDER_ROOT
  return folder === FOLDER_ROOT ? [] : folder.split('/')
}

export function skyboxPayload(content: SkyboxContent, documentId: string): unknown {
  const folder = heldIn(documentId)
  const asset = content.source ? assetsById(useAssets.getState()).get(content.source.assetId) : null

  return gltfSkyOf(content, {
    name: useDocuments.getState().documents[documentId]?.title ?? documentId,
    sourceUri: asset?.path ? mediaLinkOf(asset.path, folder) : null,
  })
}

/** Indented: a sky IS its `.gltf`, and that file is read by hand and by other tools. */
export function serializeSkyboxPayload(payload: unknown): string {
  return JSON.stringify(payload, null, 2)
}

export function skyboxFromPayload(payload: unknown, documentId: string): SkyboxContent {
  const folder = heldIn(documentId)
  return skyFromGltf(payload, uri => assetIdForLink(mediaLinkFrom(uri), folder))
}
