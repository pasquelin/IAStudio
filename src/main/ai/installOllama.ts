import { execFile, execFileSync } from 'node:child_process'
import { open as openFile } from 'node:fs/promises'
import { posix, win32 } from 'node:path'
import { promisify } from 'node:util'
import { net } from 'electron'
import { PROGRESS_STEP, taskRatio } from '@shared/domain/taskProgress'
import { chunksOf } from '@main/netStream'
import { ollamaBinary } from './ensureOllama'
import { DownloadCancelled } from './modelInstall'

const run = promisify(execFile)
const LATEST = 'https://github.com/ollama/ollama/releases/latest/download'
/** Leaves the last tenth of the bar for extract. */
const DOWNLOAD_SHARE = 0.9

export type OllamaArchive = {
  readonly url: string
  readonly kind: 'tgz' | 'tar.zst' | 'zip'
}

const PACKED_NAME: Record<OllamaArchive['kind'], string> = {
  tgz: 'ollama.tgz',
  'tar.zst': 'ollama.tar.zst',
  zip: 'ollama.zip',
}

/** Linux latest ships `.tar.zst`. `tar --zstd` needs the `zstd` binary on PATH. */
export function needsZstd(kind: OllamaArchive['kind']): boolean {
  return kind === 'tar.zst'
}

export function zstdOnPath(): boolean {
  try {
    execFileSync('zstd', ['-V'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export type InstallOllama = {
  readonly platform: NodeJS.Platform
  readonly arch: string
  readonly env: NodeJS.ProcessEnv
  readonly extraDir: string
  readonly exists: (path: string) => boolean
  readonly ensureFolder: (folder: string) => Promise<void>
  readonly download: (
    url: string,
    dest: string,
    onProgress: (ratio: number) => void,
    signal?: AbortSignal,
  ) => Promise<void>
  readonly extract: (archive: string, dest: string, kind: OllamaArchive['kind']) => Promise<void>
  readonly remove: (path: string) => Promise<void>
  readonly chmod?: (path: string) => Promise<void>
  readonly ensure: () => Promise<boolean>
  /** False when this archive needs a tool that is not on PATH — checked before any download. */
  readonly canUnpack: (kind: OllamaArchive['kind']) => boolean
  readonly onProgress: (ratio: number) => void
  readonly signal?: AbortSignal
}

function abortIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DownloadCancelled('the Ollama download was cancelled')
}

function cpuOf(arch: string): 'amd64' | 'arm64' | null {
  if (arch === 'arm64') return 'arm64'
  if (arch === 'x64') return 'amd64'
  return null
}

function tarArgs(kind: OllamaArchive['kind'], archive: string, dest: string): string[] {
  if (kind === 'tgz') return ['-xzf', archive, '-C', dest]
  if (kind === 'tar.zst') return ['--zstd', '-xf', archive, '-C', dest]
  return ['-xf', archive, '-C', dest]
}

function foundBinary(deps: InstallOllama): string | undefined {
  return ollamaBinary(deps.platform, deps.env, deps.extraDir).find(deps.exists)
}

/** Official latest build for this OS and CPU. `null` when Ollama ships none. */
export function ollamaArchive(platform: NodeJS.Platform, arch: string): OllamaArchive | null {
  if (platform === 'darwin') return { url: `${LATEST}/ollama-darwin.tgz`, kind: 'tgz' }

  const cpu = cpuOf(arch)
  if (cpu === null) return null
  if (platform === 'linux') {
    return { url: `${LATEST}/ollama-linux-${cpu}.tar.zst`, kind: 'tar.zst' }
  }
  if (platform === 'win32') {
    return { url: `${LATEST}/ollama-windows-${cpu}.zip`, kind: 'zip' }
  }
  return null
}

/**
 * Puts the official Ollama binary in `extraDir` when none is on this machine, then starts serve.
 * Never stops a copy that is already running, never deletes one.
 */
export async function installOllama(deps: InstallOllama): Promise<void> {
  abortIfCancelled(deps.signal)

  if (foundBinary(deps) !== undefined) {
    await deps.ensure()
    return
  }

  const archive = ollamaArchive(deps.platform, deps.arch)
  if (archive === null) throw new Error(`no Ollama build for ${deps.platform}-${deps.arch}`)
  if (!deps.canUnpack(archive.kind)) {
    throw new Error(`cannot unpack ${archive.kind}: zstd is not on this computer`)
  }

  await deps.ensureFolder(deps.extraDir)
  const packed = (deps.platform === 'win32' ? win32 : posix).join(
    deps.extraDir,
    PACKED_NAME[archive.kind],
  )
  await deps.download(
    archive.url,
    packed,
    ratio => deps.onProgress(ratio * DOWNLOAD_SHARE),
    deps.signal,
  )
  abortIfCancelled(deps.signal)

  deps.onProgress(DOWNLOAD_SHARE)
  await deps.extract(packed, deps.extraDir, archive.kind)
  await deps.remove(packed)

  const binary = foundBinary(deps)
  if (binary === undefined) throw new Error('Ollama archive had no binary')
  if (deps.platform !== 'win32') await deps.chmod?.(binary)

  deps.onProgress(1)
  await deps.ensure()
}

export async function fetchOllamaArchive(
  url: string,
  dest: string,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  abortIfCancelled(signal)

  const response = await net.fetch(url, { redirect: 'follow', signal })
  if (!response.ok) throw new Error(`Ollama download answered ${response.status}`)

  const total = Number(response.headers.get('content-length') ?? 0)
  const file = await openFile(dest, 'w')
  let received = 0
  let lastReport = 0
  try {
    for await (const chunk of chunksOf(response.body)) {
      abortIfCancelled(signal)
      await file.write(chunk)
      received += chunk.byteLength
      if (received - lastReport >= PROGRESS_STEP || (total > 0 && received >= total)) {
        lastReport = received
        onProgress(taskRatio(received, total))
      }
    }
  } finally {
    await file.close()
  }
}

export async function extractOllamaArchive(
  archive: string,
  dest: string,
  kind: OllamaArchive['kind'],
): Promise<void> {
  await run('tar', tarArgs(kind, archive, dest))
}
