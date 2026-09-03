import type { ExternalFileRequest } from '@shared/domain/externalFile'
import { projectName, type RecentProject } from '@shared/domain/project'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import type { DragLike } from '@/helpers/drag'

const waiting: ExternalFileRequest[] = []
let importing = false

function projectsToOffer(): RecentProject[] {
  const recent = [...useSettings.getState().settings.storage.recentProjects]
  const current = useProject.getState().project
  if (!current || recent.some(entry => entry.path === current.path)) return recent

  return [
    {
      path: current.path,
      openedAt: current.manifest.updatedAt,
      createdAt: current.manifest.createdAt,
    },
    ...recent,
  ]
}

async function chooseProject(): Promise<boolean> {
  const bridge = getBridge()
  if (!bridge) return false

  for (;;) {
    const current = useProject.getState().project
    const answer = await bridge.newDocument.ask({
      purpose: 'externalFiles',
      kind: null,
      surface: null,
      picked: null,
      projectName: current ? projectName(current.path) : null,
      recentProjects: projectsToOffer(),
      open: Object.values(useDocuments.getState().documents),
    })
    if (!answer) return false

    if (answer.answer === 'recentProject') {
      if (await useProject.getState().open(answer.path)) return true
      continue
    }

    const before = current?.path
    if (answer.answer === 'newProject') await useProject.getState().createPicked()
    if (answer.answer === 'openProject') await useProject.getState().openPicked()
    if (useProject.getState().project?.path !== before) return true
  }
}

async function importRequest(request: ExternalFileRequest): Promise<void> {
  const bridge = getBridge()
  if (!bridge) return
  if (request.project && request.project !== useProject.getState().project?.path) {
    await bridge.externalFiles.discard(request.id)
    return
  }
  if (request.folder === undefined && !(await chooseProject())) {
    await bridge.externalFiles.discard(request.id)
    return
  }

  const imported = await bridge.media.ingestPaths(request.id, request.folder ?? '')
  if (!imported?.length) return

  await useAssets.getState().refresh()
  const { openAsset } = await import('@/helpers/openAsset')
  for (const asset of imported) await openAsset(asset)
}

async function drain(): Promise<void> {
  if (importing) return
  importing = true
  try {
    while (waiting.length > 0) {
      const request = waiting.shift()
      if (!request) continue
      try {
        await importRequest(request)
      } catch (error) {
        reportFailure('assets.copy', request.id, error)
      }
    }
  } finally {
    importing = false
  }
}

export function queueExternalFiles(requests: readonly ExternalFileRequest[]): void {
  waiting.push(...requests)
  void drain()
}

export async function takeExternalFiles(): Promise<void> {
  const requests = await getBridge()?.externalFiles.take()
  if (requests) queueExternalFiles(requests)
}

export async function offerExternalFiles(
  files: FileList | undefined,
): Promise<ExternalFileRequest | null> {
  const bridge = getBridge()
  if (!bridge || !files) return null
  try {
    return await bridge.externalFiles.offer([...files])
  } catch (error) {
    reportFailure('assets.copy', 'external-file-drop', error)
    return null
  }
}

export function carriesExternalFiles(event: DragLike): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false
}
