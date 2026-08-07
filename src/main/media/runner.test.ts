import { describe, expect, it } from 'vitest'
import { companionPath, findOnPath, runProcess } from './runner'

describe('binary on the PATH', () => {
  const exists = (candidate: string): boolean => candidate === '/opt/homebrew/bin/ffmpeg'

  it('walks the PATH in order and answers the first hit', () => {
    expect(findOnPath('ffmpeg', '/usr/bin:/opt/homebrew/bin', ':', exists)).toBe(
      '/opt/homebrew/bin/ffmpeg',
    )
  })

  it('answers nothing when no entry holds it', () => {
    expect(findOnPath('ffmpeg', '/usr/bin:/bin', ':', exists)).toBeUndefined()
  })

  it('answers nothing when there is no PATH at all', () => {
    expect(findOnPath('ffmpeg', undefined, ':', exists)).toBeUndefined()
  })

  it('tries the .exe Windows needs, on the separator Windows uses', () => {
    const onWindows = (candidate: string): boolean => candidate === 'C:\\tools\\ffmpeg.exe'
    expect(findOnPath('ffmpeg', 'C:\\other;C:\\tools', ';', onWindows)).toBe(
      'C:\\tools\\ffmpeg.exe',
    )
  })
})

describe('ffprobe beside ffmpeg', () => {
  it('finds the probe next to the encoder it was resolved with', () => {
    expect(companionPath('/opt/homebrew/bin/ffmpeg')).toBe('/opt/homebrew/bin/ffprobe')
  })

  it('keeps the executable suffix Windows needs', () => {
    expect(companionPath('C:\\tools\\ffmpeg.exe')).toBe('C:\\tools\\ffprobe.exe')
  })

  it('resolves nothing when there is no encoder to sit beside', () => {
    expect(companionPath(null)).toBeNull()
  })
})

describe('process runner', () => {
  it('hands back what the binary wrote on stdout', async () => {
    const output = await runProcess(process.execPath, ['-e', 'process.stdout.write("hello")'])
    expect(output.toString('utf8')).toBe('hello')
  })

  it('rejects with what the binary said on stderr when it exits non-zero', async () => {
    const script = 'process.stderr.write("bad input"); process.exit(3)'
    await expect(runProcess(process.execPath, ['-e', script])).rejects.toThrow(/bad input/)
  })

  it('rejects when the binary cannot be spawned at all', async () => {
    await expect(runProcess('/nowhere/ffmpeg', [])).rejects.toThrow()
  })

  it('kills a run on abort, so a cancelled proxy stops costing a core', async () => {
    const controller = new AbortController()
    const running = runProcess(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {
      signal: controller.signal,
    })
    controller.abort()

    await expect(running).rejects.toThrow()
  })

  it('refuses to start at all when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      runProcess(process.execPath, ['-e', ''], { signal: controller.signal }),
    ).rejects.toThrow()
  })
})
