import { basename, extname, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { App } from 'electron'
import type {
  ExternalFileOffer,
  ExternalFileRefusal,
  ExternalFileRequest,
} from '@shared/domain/externalFile'
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
  const acceptedPaths: string[] = []
  const refused: ExternalFileRefusal[] = []
  for (const path of candidates) {
    if (isImportableFile(path)) acceptedPaths.push(path)
    else {
      refused.push({
        name: basename(path),
        extension: extname(path).slice(1).toLowerCase(),
      })
    }
  }
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

/**
 * What a command line offers, launch or second instance. `argv[0]` is CUT rather than compared:
 * it names the binary under whatever path invoked it — a symlink, another case — and a name that
 * misses `execPath` was offered for import, refused for its extension, and announced at every
 * start.
 */
export function launchedPaths(argv: readonly string[], appPath: string): string[] {
  return externalPathsFromArguments(argv.slice(1), new Set([process.execPath, appPath]))
}

export function captureExternalFiles(app: App, argv: readonly string[]): void {
  app.on('open-file', (event, path) => {
    event.preventDefault()
    offerExternalFiles([path])
  })
  offerExternalFiles(launchedPaths(argv, app.getAppPath()))
}

export function registerExternalFileHandlers(): void {
  handle(CHANNELS.externalFilesTake, () => pending.splice(0))
  handle(CHANNELS.externalFilesOffer, (_event, paths) => authoriseExternalFiles(paths))
  handle(CHANNELS.externalFilesDiscard, (_event, id) => {
    authorised.delete(id)
  })
}
