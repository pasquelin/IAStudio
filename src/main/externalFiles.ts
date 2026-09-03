import { isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { App } from 'electron'
import type { ExternalFileRequest } from '@shared/domain/externalFile'
import { sourceNatureOf } from '@shared/domain/fileRole'
import { CHANNELS, EVENTS } from '@shared/ipc'
import { broadcast } from '@main/ipc/broadcast'
import { handle } from '@main/ipc/handle'

const pending: ExternalFileRequest[] = []
const authorised = new Map<string, readonly string[]>()

function accepted(path: string): boolean {
  return isAbsolute(path) && sourceNatureOf(path).openable
}

export function externalPathsFromArguments(argv: readonly string[]): string[] {
  return argv.filter(accepted)
}

export function offerExternalFiles(paths: readonly string[]): void {
  const request = authoriseExternalFiles(paths)
  if (!request) return
  pending.push(request)
  broadcast(EVENTS.externalFiles)
}

export function authoriseExternalFiles(paths: readonly string[]): ExternalFileRequest | null {
  const acceptedPaths = paths.filter(accepted)
  if (acceptedPaths.length === 0) return null

  const id = randomUUID()
  authorised.set(id, acceptedPaths)
  return { id }
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
  offerExternalFiles(externalPathsFromArguments(argv.slice(1)))
}

export function registerExternalFileHandlers(): void {
  handle(CHANNELS.externalFilesTake, () => pending.splice(0))
  handle(CHANNELS.externalFilesOffer, (_event, paths) => authoriseExternalFiles(paths))
  handle(CHANNELS.externalFilesDiscard, (_event, id) => {
    authorised.delete(id)
  })
}
