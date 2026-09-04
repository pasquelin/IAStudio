import { basename, extname, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { App } from 'electron'
import type { ExternalFileOffer, ExternalFileRequest } from '@shared/domain/externalFile'
import { isImportableFile } from '@shared/domain/importFormat'
import { CHANNELS, EVENTS } from '@shared/ipc'
import { broadcast } from '@main/ipc/broadcast'
import { handle } from '@main/ipc/handle'

const pending: ExternalFileOffer[] = []
const authorised = new Map<string, readonly string[]>()

export function externalPathsFromArguments(
  argv: readonly string[],
  ignored: ReadonlySet<string> = new Set(),
): string[] {
  return argv.filter(path => isAbsolute(path) && !ignored.has(path))
}

export function offerExternalFiles(paths: readonly string[]): void {
  const offer = authoriseExternalFiles(paths)
  if (!offer.request && offer.refused.length === 0) return
  pending.push(offer)
  broadcast(EVENTS.externalFiles)
}

export function authoriseExternalFiles(paths: unknown): ExternalFileOffer {
  if (!Array.isArray(paths)) return { request: null, refused: [] }
  const candidates = paths.filter(one => typeof one === 'string' && isAbsolute(one))
  const acceptedPaths = candidates.filter(isImportableFile)
  const refused = candidates
    .filter(path => !isImportableFile(path))
    .map(path => ({
      name: basename(path),
      extension: extname(path).slice(1).toLowerCase(),
    }))
  if (acceptedPaths.length === 0) return { request: null, refused }

  const request: ExternalFileRequest = { id: randomUUID() }
  authorised.set(request.id, acceptedPaths)
  return { request, refused }
}

export function claimExternalFiles(id: string): readonly string[] {
  const paths = authorised.get(id) ?? []
  authorised.delete(id)
  return paths
}

export function captureExternalFiles(app: App, argv: readonly string[]): void {
  app.on('open-file', (event, path) => {
    event.preventDefault()
    offerExternalFiles([path])
  })
  const launchPaths = new Set([process.execPath, app.getAppPath()])
  offerExternalFiles(externalPathsFromArguments(argv, launchPaths))
}

export function registerExternalFileHandlers(): void {
  handle(CHANNELS.externalFilesTake, () => pending.splice(0))
  handle(CHANNELS.externalFilesOffer, (_event, paths) => authoriseExternalFiles(paths))
  handle(CHANNELS.externalFilesDiscard, (_event, id) => {
    authorised.delete(id)
  })
}
