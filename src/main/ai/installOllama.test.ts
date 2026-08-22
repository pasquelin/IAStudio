import { describe, expect, it, vi } from 'vitest'
import { installOllama, ollamaArchive, type InstallOllama } from './installOllama'

vi.mock('electron', () => ({ net: { fetch: () => Promise.reject(new Error('no net')) } }))

const LATEST = 'https://github.com/ollama/ollama/releases/latest/download'

function deps(over: Partial<InstallOllama> = {}): InstallOllama {
  return {
    platform: 'linux',
    arch: 'x64',
    env: {},
    extraDir: '/var/studio/ollama',
    exists: () => false,
    ensureFolder: () => Promise.resolve(),
    download: () => Promise.resolve(),
    extract: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    ensure: () => Promise.resolve(true),
    canUnpack: () => true,
    onProgress: () => {},
    ...over,
  }
}

describe('ollamaArchive', () => {
  it('names the official latest build for the OS and CPU it was given', () => {
    expect(ollamaArchive('darwin', 'arm64')).toEqual({
      url: `${LATEST}/ollama-darwin.tgz`,
      kind: 'tgz',
    })
    expect(ollamaArchive('darwin', 'x64')).toEqual({
      url: `${LATEST}/ollama-darwin.tgz`,
      kind: 'tgz',
    })
    expect(ollamaArchive('linux', 'x64')).toEqual({
      url: `${LATEST}/ollama-linux-amd64.tar.zst`,
      kind: 'tar.zst',
    })
    expect(ollamaArchive('linux', 'arm64')).toEqual({
      url: `${LATEST}/ollama-linux-arm64.tar.zst`,
      kind: 'tar.zst',
    })
    expect(ollamaArchive('win32', 'x64')).toEqual({
      url: `${LATEST}/ollama-windows-amd64.zip`,
      kind: 'zip',
    })
    expect(ollamaArchive('win32', 'arm64')).toEqual({
      url: `${LATEST}/ollama-windows-arm64.zip`,
      kind: 'zip',
    })
  })

  it('has no archive for an OS or CPU Ollama does not ship', () => {
    expect(ollamaArchive('linux', 'ia32')).toBeNull()
    expect(ollamaArchive('freebsd', 'x64')).toBeNull()
  })
})

describe('installOllama', () => {
  it('does not download when a binary is already on this machine', async () => {
    const download = vi.fn()
    const extract = vi.fn()
    const ensure = vi.fn(() => Promise.resolve(true))

    await installOllama(
      deps({
        exists: path => path === '/usr/bin/ollama',
        download,
        extract,
        ensure,
      }),
    )

    expect(download).not.toHaveBeenCalled()
    expect(extract).not.toHaveBeenCalled()
    expect(ensure).toHaveBeenCalledOnce()
  })

  it('downloads the archive of the given platform, extracts it, then starts serve', async () => {
    const download = vi.fn((_url: string, _dest: string, onProgress: (ratio: number) => void) => {
      onProgress(1)
      return Promise.resolve()
    })
    const extract = vi.fn()
    const remove = vi.fn()
    const chmod = vi.fn()
    const ensure = vi.fn(() => Promise.resolve(true))
    const seen: number[] = []
    let unpacked = false

    await installOllama(
      deps({
        exists: path => unpacked && path === '/var/studio/ollama/bin/ollama',
        download,
        extract: (archive, dest, kind) => {
          unpacked = true
          return extract(archive, dest, kind)
        },
        remove,
        chmod,
        ensure,
        onProgress: ratio => seen.push(ratio),
      }),
    )

    expect(download).toHaveBeenCalledWith(
      `${LATEST}/ollama-linux-amd64.tar.zst`,
      '/var/studio/ollama/ollama.tar.zst',
      expect.any(Function),
      undefined,
    )
    expect(extract).toHaveBeenCalledWith(
      '/var/studio/ollama/ollama.tar.zst',
      '/var/studio/ollama',
      'tar.zst',
    )
    expect(remove).toHaveBeenCalledWith('/var/studio/ollama/ollama.tar.zst')
    expect(chmod).toHaveBeenCalledWith('/var/studio/ollama/bin/ollama')
    expect(ensure).toHaveBeenCalledOnce()
    expect(seen.at(-1)).toBe(1)
  })

  it('uses the windows zip and that platform separator', async () => {
    const download = vi.fn()
    const chmod = vi.fn()
    let unpacked = false

    await installOllama(
      deps({
        platform: 'win32',
        arch: 'arm64',
        extraDir: 'E:\\studio\\ollama',
        exists: path => unpacked && path === 'E:\\studio\\ollama\\ollama.exe',
        download,
        extract: () => {
          unpacked = true
          return Promise.resolve()
        },
        chmod,
      }),
    )

    expect(download.mock.calls[0]?.[0]).toBe(`${LATEST}/ollama-windows-arm64.zip`)
    expect(download.mock.calls[0]?.[1]).toBe('E:\\studio\\ollama\\ollama.zip')
    expect(chmod).not.toHaveBeenCalled()
  })

  it('does not extract when the download is aborted', async () => {
    const extract = vi.fn()
    const abort = new AbortController()
    abort.abort()

    await expect(installOllama(deps({ extract, signal: abort.signal }))).rejects.toThrow(
      /cancelled/,
    )
    expect(extract).not.toHaveBeenCalled()
  })

  it('does not download a linux archive when zstd is not on this computer', async () => {
    const download = vi.fn()

    await expect(installOllama(deps({ canUnpack: () => false, download }))).rejects.toThrow(/zstd/)
    expect(download).not.toHaveBeenCalled()
  })

  it('refuses an OS Ollama does not ship, before any download', async () => {
    const download = vi.fn()

    await expect(installOllama(deps({ platform: 'freebsd', download }))).rejects.toThrow(
      /no Ollama build/,
    )
    expect(download).not.toHaveBeenCalled()
  })
})
