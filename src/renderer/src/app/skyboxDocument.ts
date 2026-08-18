import { FOLDER_ROOT, parentOf } from '@shared/domain/folder'
import type { SkyboxContent } from '@shared/domain/skybox'
import { isRecord } from '@shared/guards'
import i18next from 'i18next'
import { gltfSkyOf, skyFromGltf, skySourceUri } from '@/engines/skybox/gltfSky'
import { mediaLinkFrom, mediaLinkOf } from '@/engines/timeline/mediaLink'
import { assetIdForLink } from '@/helpers/assetIndex'
import { reportNotice } from '@/services/diagnostics'
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

/**
 * What the last read found in the file and this editor does not compose back — the link to the
 * picture, so a sky whose asset row this window has not been shown does not lose it.
 *
 * A montage keeps the same kind of memory, and for the same reason: what a file carries and the
 * editor cannot rebuild is destroyed by the first save that does not carry it across.
 */
const carried = new Map<string, { sourceUri: string }>()

export const forgetCarriedSky = (documentId: string): void => {
  carried.delete(documentId)
}

export function skyboxPayload(content: SkyboxContent, documentId: string): unknown {
  const folder = heldIn(documentId)
  const asset = content.source ? assetsById(useAssets.getState()).get(content.source.assetId) : null

  return gltfSkyOf(content, {
    name: useDocuments.getState().documents[documentId]?.title ?? documentId,
    // The catalogue first, and what the file already said when it answers nothing: this window
    // holds only the assets it has been SHOWN, and writing no link at all would take the picture
    // out of the file for every other reader.
    sourceUri: asset?.path
      ? mediaLinkOf(asset.path, folder)
      : (carried.get(documentId)?.sourceUri ?? null),
  })
}

/** Indented: a sky IS its `.gltf`, and that file is read by hand and by other tools. */
export function serializeSkyboxPayload(payload: unknown): string {
  return JSON.stringify(payload, null, 2)
}

/**
 * The keys of a glTF this editor composes. Anything ELSE at the root is a scene graph the studio
 * would destroy: the nodes are recomposed from two, so a mesh or a camera carried across would
 * point at indices that no longer mean what they meant.
 */
const COMPOSED = new Set([
  'asset',
  'scene',
  'scenes',
  'nodes',
  'extensionsUsed',
  'extensionsRequired',
  'extensions',
  'extras',
])

/**
 * Skies that opened holding LESS than their file did — a `.gltf` somebody added a mesh, a camera
 * or an animation to.
 *
 * Read by `savableDocument`, exactly as an incomplete montage is: glTF is an INDEX-LINKED graph, so
 * carrying those parts across a save is not a thing that can be done half way — a `meshes` kept
 * without its `accessors`, or beside nodes recomposed from two, is a broken file. Refusing is the
 * only honest answer, and the file stays as its author left it.
 */
const incomplete = new Set<string>()

/** The sentence a refusal says, or `null` — the montage's would talk about clips. */
export const skyRefusesToSave = (documentId: string): string | null =>
  incomplete.has(documentId) ? i18next.t('documents.saveRefusedSkyHoldsMore') : null

export function skyboxFromPayload(payload: unknown, documentId: string): SkyboxContent {
  incomplete.delete(documentId)
  const uri = skySourceUri(payload)
  if (uri) carried.set(documentId, { sourceUri: uri })
  else carried.delete(documentId)

  const extra = isRecord(payload) ? Object.keys(payload).filter(key => !COMPOSED.has(key)) : []
  if (extra.length > 0) {
    incomplete.add(documentId)
    reportNotice('document.load', i18next.t('documents.skyHoldsMore', { parts: extra.join(', ') }))
  }

  const folder = heldIn(documentId)
  return skyFromGltf(payload, link => assetIdForLink(mediaLinkFrom(link), folder))
}
