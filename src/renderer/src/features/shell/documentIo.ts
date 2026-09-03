import { getBridge } from '@/services/bridge'
import { reportFailure, reportNotice } from '@/services/diagnostics'
import { assetsById, useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { useLivePreviews } from '@/stores/livePreviews'
import { useMaterialViews } from '@/stores/materialViews'
import { useMonitorPair } from '@/stores/monitorPair'
import { usePlayback } from '@/stores/playback'
import { useSkyboxViews } from '@/stores/skyboxViews'
import { type CloseChoice, type DocumentDescriptor } from '@shared/domain/document'
import { FOLDER_ROOT, parentOf } from '@shared/domain/folder'
import {
  formatOfFile,
  lossesFor,
  type CapabilityTrait,
  type WritableFormat,
} from '@shared/domain/formatCapability'
import type { StudioBridge } from '@shared/ipc'
import i18next from 'i18next'
import { closePanel, openDocument } from './components/dockviewApi'
import { IO_BY_KIND, ioOf, type CapturedDraft, type DocumentIo } from './documentIoAdapters'
const unreadable = new Set<string>()
const assetBehind = new Set<string>()
const flattenAgreed = new Set<string>()
async function agreedToFlatten(
  document: DocumentDescriptor,
  format: WritableFormat,
  losses: readonly CapabilityTrait[],
): Promise<boolean> {
  if (flattenAgreed.has(document.id)) return true
  const agreed = await askedToFlatten(
    document.title,
    format.toUpperCase(),
    losses.map(trait => i18next.t(`traits.${trait}`)).join(', '),
  )
  if (agreed) flattenAgreed.add(document.id)
  return agreed
}
const askedToFlatten = async (title: string, format: string, lost: string): Promise<boolean> =>
  (await getBridge()?.documents.confirmFlatten(title, format, lost)) ?? true
type SavableDocument = {
  bridge: StudioBridge
  document: DocumentDescriptor
  io: DocumentIo
}

function savableDocument(documentId: string, byHand = true): SavableDocument | null {
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  const io = ioOf(documentId)
  if (!bridge || !document || !io) return null
  if (unreadable.has(documentId) || !io.holds(documentId)) return null
  const refusal = io.incomplete?.(documentId)
  if (refusal) {
    if (byHand) reportNotice('document.save', refusal)
    return null
  }
  return { bridge, document, io }
}
export async function saveDocument(documentId: string, byHand = true): Promise<boolean> {
  const savable = savableDocument(documentId, byHand)
  if (!savable) return false
  const { bridge, document, io } = savable
  if (io.assetOnly) return await io.saveOwn(documentId)
  const { draft, commit, wasEdited } = await io.capture(documentId)
  const payload = {
    ...draft,
    title: document.title,
    ...(document.sourceAssetId ? { sourceAssetId: document.sourceAssetId } : {}),
  }
  const folder = parentOf(document.path) ?? FOLDER_ROOT
  if (
    (await bridge.documents.write(document.id, document.kind, payload, false, folder)) === 'stale'
  ) {
    if (!byHand || !(await bridge.documents.confirmOverwrite(document.title))) return false
    await bridge.documents.write(document.id, document.kind, payload, true, folder)
  }
  commit()
  if (!byHand) return true
  await rewriteSourceAsset(document, io, wasEdited, draft)
  void useDocuments.getState().relist('own-write')
  return true
}
function writePlanFor(
  document: DocumentDescriptor,
  io: DocumentIo,
  sourceAssetId: string,
): {
  format: WritableFormat
  losses: CapabilityTrait[]
} {
  const written =
    formatOfFile(assetsById(useAssets.getState()).get(sourceAssetId)?.path ?? '') ?? 'ora'
  if (!io.traitsOf) return { format: written, losses: [] }
  return { format: written, losses: lossesFor(io.traitsOf(document.id), written) }
}
async function rewriteSourceAsset(
  document: DocumentDescriptor,
  io: DocumentIo,
  wasEdited: boolean,
  captured: CapturedDraft,
): Promise<void> {
  const source = document.sourceAssetId
  if (!source || !io.writeAsset) return
  if (!wasEdited && !assetBehind.has(document.id)) return
  const { format, losses } = writePlanFor(document, io, source)
  if (losses.length > 0 && !(await agreedToFlatten(document, format, losses))) return
  try {
    const written = await io.writeAsset(
      document.id,
      { replaces: source, name: document.title, format },
      captured,
    )
    if (!written) throw new Error('nothing to bake yet')
    assetBehind.delete(document.id)
    useLivePreviews.getState().revokePreview(source)
    useAssets.getState().invalidate()
  } catch (error) {
    assetBehind.add(document.id)
    reportFailure('assets.save', document.title, error)
  }
}
async function copyDocumentAsset(
  documentId: string,
  { bridge, document, io }: SavableDocument,
): Promise<boolean> {
  const source = document.sourceAssetId
  if (!source || !io.writeAsset || io.assetOnly) {
    reportFailure('assets.copy', document.title, new Error('nothing to copy'))
    return false
  }
  const name = i18next.t('documents.copyName', { name: document.title })
  const { format, losses } = writePlanFor(document, io, source)
  try {
    const { draft } = await io.capture(documentId)
    const copy = await io.writeAsset(
      documentId,
      { derivedFrom: source, name, format: losses.length === 0 ? format : 'ora' },
      draft,
    )
    if (!copy) {
      reportFailure('assets.copy', document.title, new Error('nothing to bake yet'))
      return false
    }
    const created = await useDocuments
      .getState()
      .create(document.workspace, { title: name, sourceAssetId: copy.id })
    if (!created) {
      reportFailure('assets.copy', document.title, new Error('no document for the copy'))
      return false
    }
    await bridge.documents.write(
      created.id,
      created.kind,
      {
        ...draft,
        title: name,
        sourceAssetId: copy.id,
      },
      false,
      parentOf(created.path) ?? FOLDER_ROOT,
    )
    openDocument(created)
    await useAssets.getState().refresh()
    void useDocuments.getState().relist('own-write')
    return true
  } catch (error) {
    reportFailure('assets.copy', document.title, error)
    return false
  }
}

export async function saveDocumentAs(documentId: string): Promise<boolean> {
  const savable = savableDocument(documentId)
  return savable ? await copyDocumentAsset(documentId, savable) : false
}
const loading = new Map<string, Promise<void>>()
export function restoreDocument(documentId: string): Promise<void> {
  const existing = loading.get(documentId)
  if (existing) return existing
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  const io = ioOf(documentId)
  if (!io || io.holds(documentId)) return Promise.resolve()
  if (io.assetOnly) return Promise.resolve()
  if (!bridge || !document) {
    io.createDefault(documentId)
    return Promise.resolve()
  }
  unreadable.delete(documentId)
  const reading = bridge.documents
    .read(document.id, document.kind)
    .then(file => {
      if (io.holds(documentId)) return
      if (file) io.install(documentId, file.content, file.parts)
      else io.createDefault(documentId)
    })
    .catch(error => {
      unreadable.add(documentId)
      reportFailure('document.load', document.title, error)
    })
    .finally(() => loading.delete(documentId))
  loading.set(documentId, reading)
  return reading
}
export async function rehydrateDocument(documentId: string): Promise<void> {
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  const io = ioOf(documentId)
  if (!bridge || !document || !io?.rehydrate) return
  if (!io.holds(documentId) || unreadable.has(documentId)) return
  try {
    const file = await bridge.documents.read(document.id, document.kind)
    if (file?.parts?.length) return io.rehydrate(documentId, file.content, file.parts)
    if (document.sourceAssetId) await io.rehydrateFromAsset?.(documentId, document.sourceAssetId)
  } catch (error) {
    reportFailure('document.load', document.title, error)
  }
}
export function documentIsDirty(documentId: string): boolean {
  const io = ioOf(documentId)
  return io !== undefined && io.holds(documentId) && io.dirty(documentId)
}
let settling = 0
async function whileSettling<T>(body: () => Promise<T>): Promise<T> {
  settling += 1
  try {
    return await body()
  } finally {
    settling -= 1
  }
}
async function askAboutUnsavedWork(documentId: string): Promise<CloseChoice> {
  const title = useDocuments.getState().documents[documentId]?.title ?? ''
  return (await getBridge()?.documents.confirmClose(title)) ?? 'cancel'
}
export async function closeDocument(documentId: string): Promise<boolean> {
  return await whileSettling(async () => {
    if (documentIsDirty(documentId)) {
      const choice = await askAboutUnsavedWork(documentId)
      if (choice === 'cancel') return false
      if (choice === 'save' && !(await saveDocument(documentId))) return false
    }
    forgetDocument(documentId)
    return true
  })
}
export function unsavedDocumentIds(): string[] {
  return Object.keys(useDocuments.getState().documents).filter(documentIsDirty)
}
export async function autosaveOpenDocuments(): Promise<void> {
  if (settling > 0) return
  let wrote = false
  for (const documentId of unsavedDocumentIds()) {
    if (ioOf(documentId)?.autosaves === false) continue
    try {
      wrote = (await saveDocument(documentId, false)) || wrote
    } catch {
      continue
    }
  }
  if (wrote) void useDocuments.getState().relist('own-write')
}
export async function settleUnsavedWork(): Promise<boolean> {
  return await settleUnsaved(true)
}
export async function settleUnsavedWorkForProjectChange(): Promise<boolean> {
  return await settleUnsaved(false)
}
async function settleUnsaved(andForget: boolean): Promise<boolean> {
  return await whileSettling(async () => {
    const answers: Array<{
      documentId: string
      choice: CloseChoice
    }> = []
    for (const documentId of unsavedDocumentIds()) {
      const choice = await askAboutUnsavedWork(documentId)
      if (choice === 'cancel') return false
      answers.push({ documentId, choice })
    }
    for (const { documentId, choice } of answers) {
      if (choice === 'save' && !(await saveDocument(documentId))) return false
      if (andForget) forgetDocument(documentId)
    }
    return true
  })
}
export async function deleteDocument(documentId: string): Promise<boolean> {
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  if (!bridge || !document) return false
  return (await bridge.documents.confirmDelete(document.title)) && dropDocument(documentId)
}
export async function dropDocument(documentId: string): Promise<boolean> {
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  if (!bridge || !document) return false
  await bridge.documents.remove(document.id, document.kind)
  forgetDocument(documentId)
  void useDocuments.getState().relist('own-write')
  return true
}
export async function refreshDocuments(): Promise<boolean> {
  const wereOpen = Object.values(useDocuments.getState().documents)
  const answered = await useDocuments.getState().refresh()
  const { documents } = useDocuments.getState()
  for (const document of wereOpen) {
    if (!documents[document.id]) forgetDocument(document.id, document)
  }
  return answered
}
function forgetDocument(documentId: string, gone?: DocumentDescriptor): void {
  const document = gone ?? useDocuments.getState().documents[documentId]
  if (document) IO_BY_KIND[document.kind].forget(document)
  unreadable.delete(documentId)
  assetBehind.delete(documentId)
  flattenAgreed.delete(documentId)
  useMaterialViews.getState().forget(documentId)
  useSkyboxViews.getState().forget(documentId)
  useMonitorPair.getState().forgetMonitorPair(documentId)
  usePlayback.getState().clearHead(documentId)
  closePanel(documentId)
  useDocuments.getState().close(documentId)
}
