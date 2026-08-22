import { describe, expect, it, vi } from 'vitest'
import { ensureOllama, ollamaBinary, type EnsureOllama } from './ensureOllama'

function deps(over: Partial<EnsureOllama> = {}): EnsureOllama {
  return {
    platform: 'darwin',
    env: {},
    exists: () => false,
    spawn: () => {},
    ping: () => Promise.resolve(false),
    wait: () => Promise.resolve(),
    now: () => 0,
    ...over,
  }
}

describe('ollamaBinary', () => {
  it('names the usual darwin locations, and PATH last', () => {
    expect(ollamaBinary('darwin', { PATH: '/custom/bin:/other' })).toEqual([
      '/opt/homebrew/bin/ollama',
      '/usr/local/bin/ollama',
      '/Applications/Ollama.app/Contents/Resources/ollama',
      '/custom/bin/ollama',
      '/other/ollama',
    ])
  })

  it('names the usual linux locations, and PATH last — not a Mac tree', () => {
    expect(ollamaBinary('linux', { HOME: '/home/u', PATH: '/opt/bin:/usr/local/bin' })).toEqual([
      '/usr/local/bin/ollama',
      '/usr/bin/ollama',
      '/snap/bin/ollama',
      '/home/u/.local/bin/ollama',
      '/opt/bin/ollama',
      '/usr/local/bin/ollama',
    ])
  })

  it('names the windows folders with that platform separator and exe', () => {
    expect(
      ollamaBinary('win32', {
        LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local',
        ProgramFiles: 'C:\\Program Files',
        'ProgramFiles(x86)': 'C:\\Program Files (x86)',
        Path: 'D:\\tools;E:\\bin',
      }),
    ).toEqual([
      'C:\\Users\\a\\AppData\\Local\\Programs\\Ollama\\ollama.exe',
      'C:\\Program Files\\Ollama\\ollama.exe',
      'C:\\Program Files (x86)\\Ollama\\ollama.exe',
      'D:\\tools\\ollama.exe',
      'E:\\bin\\ollama.exe',
    ])
  })
})

describe('ensureOllama', () => {
  it('does not spawn when the service already answers', async () => {
    const spawn = vi.fn()
    const ensure = ensureOllama(deps({ ping: () => Promise.resolve(true), spawn }))

    expect(await ensure()).toBe(true)
    expect(spawn).not.toHaveBeenCalled()
  })

  it('does not spawn when no binary is on this machine', async () => {
    const spawn = vi.fn()
    const ensure = ensureOllama(deps({ spawn, exists: () => false }))

    expect(await ensure()).toBe(false)
    expect(spawn).not.toHaveBeenCalled()
  })

  it('spawns serve from the binary of the platform it was given', async () => {
    const cases: { platform: NodeJS.Platform; env: NodeJS.ProcessEnv; binary: string }[] = [
      { platform: 'darwin', env: {}, binary: '/opt/homebrew/bin/ollama' },
      { platform: 'linux', env: {}, binary: '/usr/bin/ollama' },
      {
        platform: 'win32',
        env: { LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' },
        binary: 'C:\\Users\\a\\AppData\\Local\\Programs\\Ollama\\ollama.exe',
      },
    ]

    for (const { platform, env, binary } of cases) {
      const spawn = vi.fn()
      let up = false
      const ensure = ensureOllama(
        deps({
          platform,
          env,
          exists: path => path === binary,
          spawn: (command, args) => {
            spawn(command, args)
            up = true
          },
          ping: () => Promise.resolve(up),
        }),
      )

      expect(await ensure(), platform).toBe(true)
      expect(spawn).toHaveBeenCalledWith(binary, ['serve'])
    }
  })

  it('does not spawn twice while the first start is in flight', async () => {
    const spawn = vi.fn()
    let release!: (up: boolean) => void
    let asked = 0
    const ping = () => {
      asked += 1
      if (asked === 1) {
        return new Promise<boolean>(resolve => {
          release = resolve
        })
      }
      return Promise.resolve(true)
    }
    const ensure = ensureOllama(
      deps({
        exists: path => path === '/usr/local/bin/ollama',
        spawn,
        ping,
      }),
    )

    const first = ensure()
    const second = ensure()
    release(false)

    expect(await first).toBe(true)
    expect(await second).toBe(true)
    expect(spawn).toHaveBeenCalledOnce()
  })

  it('does not spawn again inside the cooldown after a start that stayed down', async () => {
    const spawn = vi.fn()
    let clock = 0
    const ensure = ensureOllama(
      deps({
        exists: path => path === '/opt/homebrew/bin/ollama',
        spawn,
        ping: () => Promise.resolve(false),
        now: () => clock,
      }),
    )

    expect(await ensure()).toBe(false)
    clock = 10_000
    expect(await ensure()).toBe(false)
    expect(spawn).toHaveBeenCalledOnce()
  })
})
