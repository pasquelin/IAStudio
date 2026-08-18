import { open, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { Asset, MediaProbe } from '@shared/domain/asset'
import { domainFromSignature, SIGNATURE_BYTES } from '@shared/domain/domainFromSignature'
import { stemOf } from '@shared/domain/fileName'
import { natureOf, opensInStudio } from '@shared/domain/fileRole'
import { isPrivatePath } from '@shared/domain/folder'
import { assetFilePath } from '@main/assets/protocol'
import type { AsyncCatalog } from '@main/project/catalogClient'
import type { ActivityReport } from '@main/project/activityLog'

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
 * Adoptions in flight, by path. The catalogue holds no unique index on `path`, and the row only
 * exists once the fingerprint and the probe have answered — seconds, for a rush. Two double-clicks
 * in that window would otherwise mint two rows over one file, and derive it twice.
 */
const running = new Map<string, Promise<Asset | null>>()

/**
 * Gives a file the project already holds a row in the catalogue, so the studio can open it.
 * Writes `path` where `ingest` writes `sourcePath` — that is what lets the rescan follow the
 * file — and answers `null` for what the studio would not show, which the caller sends outside.
 */
export async function adoptFile(relative: string, deps: AdoptFileDeps): Promise<Asset | null> {
  const already = running.get(relative)
  if (already) return already

  const adopting = adopt(relative, deps).finally(() => running.delete(relative))
  running.set(relative, adopting)
  return adopting
}

async function adopt(relative: string, deps: AdoptFileDeps): Promise<Asset | null> {
  // What the studio keeps for itself is shown, never taken: `.index/` holds the previews and the
  // proxies it rewrites at will, and a row pointing into it would die at the next eviction.
  if (isPrivatePath(relative)) return null

  const catalog = deps.catalog()
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
