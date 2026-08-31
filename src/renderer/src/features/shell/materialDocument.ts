import { isMtlxDocument, type MtlxDocument } from '@shared/domain/materialX'
import { PBR_CHANNELS, type PbrChannel } from '@shared/domain/material'
import i18next from 'i18next'
import { documentFolder } from '@/features/shell/documentFolder'
import { channelOfInput, materialFromMtlx, mtlxMaterialOf } from '@/engines/material/mtlxMaterial'
import { newMaterial, type MaterialState } from '@/engines/material/materialState'
import { mediaLinkFrom, mediaLinkOf } from '@/engines/timeline/mediaLink'
import { assetIdForLink } from '@/helpers/assetIndex'
import { reportNotice } from '@/services/diagnostics'
import { assetsById, useAssets } from '@/stores/assets'

/**
 * A material on its way to and from its file, which is a MaterialX one and nothing else.
 *
 * Composed by the WINDOW, for the reason the sky is: only this side holds the catalogue a channel
 * is resolved against, and the file names its pictures by PATH — an id would name nothing to any
 * other application, and nothing at all in another project.
 */

/**
 * What the last read found in the file and this editor cannot compose back — the path of each
 * channel's picture, so a material whose asset rows this window has not been shown does not lose
 * them. The sky keeps the same memory, and for the same reason.
 */
const carried = new Map<string, Partial<Record<PbrChannel, string>>>()

export const forgetCarriedMaterial = (documentId: string): void => {
  carried.delete(documentId)
}

/** Materials that opened holding MORE than this studio composes — a second material, a look. */
const incomplete = new Set<string>()

export const materialRefusesToSave = (documentId: string): string | null =>
  incomplete.has(documentId) ? i18next.t('documents.saveRefusedMaterialHoldsMore') : null

/** Where each channel's picture sits, relative to the document's folder. */
function filesFor(state: MaterialState, documentId: string): Partial<Record<PbrChannel, string>> {
  const folder = documentFolder(documentId)
  const byId = assetsById(useAssets.getState())
  const held = carried.get(documentId) ?? {}
  const files: Partial<Record<PbrChannel, string>> = {}

  for (const channel of PBR_CHANNELS) {
    const assetId = state.channels[channel]?.assetId
    if (!assetId) continue
    // The catalogue first, and what the file already said when it answers nothing: this window
    // holds only the assets it has been SHOWN, and writing no path would take the picture out of
    // the file for every other reader.
    const path = byId.get(assetId)?.path
    const link = path ? mediaLinkOf(path, folder) : held[channel]
    if (link) files[channel] = link
  }
  return files
}

export function materialPayload(state: MaterialState, documentId: string): MtlxDocument {
  return mtlxMaterialOf(state, { files: filesFor(state, documentId) })
}

export function materialFromPayload(payload: unknown, documentId: string): MaterialState {
  incomplete.delete(documentId)
  if (!isMtlxDocument(payload)) return newMaterial()

  const folder = documentFolder(documentId)
  const state = materialFromMtlx(payload, file => assetIdForLink(mediaLinkFrom(file), folder))

  const paths: Partial<Record<PbrChannel, string>> = {}
  for (const image of payload.images) {
    const channel = channelOfInput(image.input)
    if (channel) paths[channel] = image.file
  }
  if (Object.keys(paths).length > 0) carried.set(documentId, paths)
  else carried.delete(documentId)

  if (payload.extra && payload.extra.length > 0) {
    incomplete.add(documentId)
    reportNotice(
      'document.load',
      i18next.t('documents.materialHoldsMore', { parts: payload.extra.join(', ') }),
    )
  }

  return state
}
