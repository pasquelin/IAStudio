import { isAbsolute } from 'node:path'
import type { App } from 'electron'
import type { ExternalFileRequest } from '@shared/domain/externalFile'
import { sourceNatureOf } from '@shared/domain/fileRole'
import { CHANNELS, EVENTS } from '@shared/ipc'
import { broadcast } from '@main/ipc/broadcast'
import { handle } from '@main/ipc/handle'

const pending: ExternalFileRequest[] = []

function accepted(path: string): boolean {
  return isAbsolute(path) && sourceNatureOf(path).openable
}

export function externalPathsFromArguments(argv: readonly string[]): string[] {
  return argv.filter(accepted)
}

export function offerExternalFiles(paths: readonly string[]): void {
  const acceptedPaths = paths.filter(accepted)
  if (acceptedPaths.length === 0) return

  const request: ExternalFileRequest = { paths: acceptedPaths }
  pending.push(request)
  broadcast(EVENTS.externalFiles)
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
}
