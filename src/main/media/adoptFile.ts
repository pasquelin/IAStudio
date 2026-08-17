import { open, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { Asset, MediaProbe } from '@shared/domain/asset'
import { domainFromSignature, SIGNATURE_BYTES } from '@shared/domain/domainFromSignature'
import { stemOf } from '@shared/domain/file-name'
import { natureOf, opensInStudio } from '@shared/domain/file-role'
import { assetFilePath } from '@main/assets/protocol'
import type { AsyncCatalog } from '@main/project/catalog-client'
import type { ActivityReport } from '@main/project/activity-log'

export type AdoptFileDeps = {
  projectPath: () => string
  catalog: () => AsyncCatalog
  newAssetId: () => string
  now: () => string
  /** The SAME fingerprint the rescan computes — without it the row cannot follow its file. */
  hash: (path: string) => Promise<string | null>
  probeFile: (path: string) => Promise<MediaProbe | null>
  /**
   * What every other arrival goes through — the proxy, the waveform and the still. Shared with
   * the download path rather than written again: a file adopted here needs exactly what a
   * generated one needs, and two derivers would drift.
   */
  onAdopted: (asset: Asset) => void
  record: (report: ActivityReport) => void
}

/**
 * Which domain a file in the project belongs to, or nothing when the studio has no editor for
 * it. The extension answers when there is one — even when it lies, which is what every system
 * does — and the first bytes answer when there is none.
 */
async function domainOf(fileName: string, absolute: string): Promise<Asset['type'] | null> {
  const nature = natureOf(fileName)
  // A document is not adopted: it is opened, and the explorer has already sent it that way.
  if (nature.role === 'edit') return null

  if (fileName.includes('.')) {
    return opensInStudio(fileName) && nature.domain !== 'other' ? nature.domain : null
  }

  const handle = await open(absolute)
  try {
    const head = new Uint8Array(SIGNATURE_BYTES)
    await handle.read(head, 0, SIGNATURE_BYTES, 0)
    return domainFromSignature(head)
  } finally {
    await handle.close()
  }
}

/**
 * Gives a file the project already holds a row in the catalogue, so the studio can open it.
 * Writes `path` where `ingest` writes `sourcePath` — that is what lets the rescan follow the
 * file — and answers `null` for what the studio would not show, which the caller sends outside.
 */
export async function adoptFile(relative: string, deps: AdoptFileDeps): Promise<Asset | null> {
  const catalog = deps.catalog()

  // Asked first, and it is what makes a second double-click harmless: the row exists by then.
  const known = await catalog.search({ path: relative, limit: 1 })
  if (known[0]) return known[0]

  const absolute = assetFilePath(deps.projectPath(), relative)
  if (!absolute) return null

  const stats = await stat(absolute)
  if (!stats.isFile()) return null

  const name = basename(relative)
  const type = await domainOf(name, absolute)
  if (!type) return null

  // Together: ffprobe spawns a process and the fingerprint reads the file, and the tab the user
  // is waiting for is behind both.
  const [probe, fingerprint] = await Promise.all([
    type === 'video' || type === 'audio' ? deps.probeFile(absolute) : null,
    deps.hash(absolute),
  ])
  const at = deps.now()

  const asset = await catalog.add({
    id: deps.newAssetId(),
    name: stemOf(name),
    type,
    location: 'local',
    path: relative,
    bytes: stats.size,
    tags: [],
    createdAt: at,
    localChangedAt: at,
    ...(fingerprint ? { hash: fingerprint } : {}),
    ...(probe ? { probe } : {}),
  })

  deps.record({
    level: 'info',
    topic: 'project',
    messageKey: 'activity.fileAdopted',
    params: { name: asset.name },
  })
  deps.onAdopted(asset)

  return asset
}
