import { describe, expect, it, vi } from 'vitest'

const getGPUInfo = vi.fn(() => Promise.resolve({ machineModelName: 'Mac' }))
const statfs = vi.fn<(path: string) => Promise<{ bavail: number; bsize: number }>>(() =>
  Promise.resolve({ bavail: 1_000, bsize: 4_096 }),
)
const readFile = vi.fn<(path: string, encoding: string) => Promise<string>>(() =>
  Promise.resolve(
    'MemTotal:       65805452 kB\nMemFree:          412340 kB\nMemAvailable:   58230144 kB\n',
  ),
)

vi.mock('electron', () => ({ app: { getGPUInfo } }))
vi.mock('node:fs/promises', () => ({
  statfs: (path: string) => statfs(path),
  readFile: (path: string, encoding: string) => readFile(path, encoding),
}))

const { electronHardwarePort } = await import('./electronHardwarePort')

const port = () => electronHardwarePort('/user/data')

describe('electronHardwarePort', () => {
  it('reads free space where the weights would land, not where the app is installed', async () => {
    await expect(port().diskFreeBytes()).resolves.toBe(4_096_000)
    expect(statfs).toHaveBeenCalledWith('/user/data')
  })

  // `basic` and `complete` carry the same four keys, but only `complete` fills `glRenderer` —
  // measured 2026-08-21, and it is the one field naming the actual hardware.
  it('asks getGPUInfo for the complete answer', async () => {
    await port().gpuInfo()

    expect(getGPUInfo).toHaveBeenCalledWith('complete')
  })
})

describe('the Linux reading', () => {
  const onLinux = async <T>(run: () => Promise<T>): Promise<T> => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    try {
      return await run()
    } finally {
      if (platform) Object.defineProperty(process, 'platform', platform)
    }
  }

  // `os.freemem()` reports MemFree on Linux, which excludes the page cache: on a healthy machine
  // it answers a few hundred MB and the probe would refuse every model. This is the one platform
  // the CI runs on, so the wrong reading would be the only one ever exercised.
  it('takes MemAvailable rather than MemFree', async () => {
    await expect(onLinux(() => port().availableBytes())).resolves.toBe(58_230_144 * 1024)
    expect(readFile).toHaveBeenCalledWith('/proc/meminfo', 'utf8')
  })

  it('answers absent rather than zero when the field is missing', async () => {
    readFile.mockResolvedValueOnce('MemTotal: 100 kB\nMemFree: 50 kB\n')

    await expect(onLinux(() => port().availableBytes())).resolves.toBeNull()
  })

  // The port lets it through: `hardwareProbe` holds the "absence rather than a guess" policy for
  // both of its failable readings, so a second port cannot forget to.
  it('lets an unreadable /proc reject, for the probe to absorb', async () => {
    readFile.mockRejectedValueOnce(new Error('ENOENT'))

    await expect(onLinux(() => port().availableBytes())).rejects.toThrow()
  })
})
