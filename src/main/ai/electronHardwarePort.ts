import { readFile, statfs } from 'node:fs/promises'
import { availableParallelism, freemem, totalmem } from 'node:os'
import { app } from 'electron'
import type { HardwarePort } from './hardwareProbe'

/**
 * `MemAvailable` rather than `os.freemem()`, which on Linux reports `MemFree` and therefore
 * excludes the page cache: on a healthy machine it answers a few hundred MB and the probe would
 * refuse every model. `[D]` `MemAvailable` is the kernel's own estimate of what a new workload
 * could take.
 */
async function linuxAvailableBytes(): Promise<number | null> {
  const line = (await readFile('/proc/meminfo', 'utf8'))
    .split('\n')
    .find(entry => entry.startsWith('MemAvailable:'))
  const kilobytes = Number(line?.split(/\s+/)[1])

  return Number.isFinite(kilobytes) ? kilobytes * 1024 : null
}

/**
 * The real machine behind `HardwarePort` — the only file of the probe that touches Electron or
 * `os`, which is what keeps `hardwareProbe` testable without either.
 */
export function electronHardwarePort(userDataPath: string): HardwarePort {
  return {
    platform: () => process.platform,
    arch: () => process.arch,
    cpuCount: availableParallelism,
    totalBytes: totalmem,
    // Measured 2026-08-21 on Apple Silicon: `freemem()` answers free + speculative pages and
    // ignores reclaimable inactive ones — 29.51 GB reported against 31.58 GB left uncounted. It is
    // an under-estimate everywhere, and only Linux offers a better reading without a subprocess.
    availableBytes: () =>
      process.platform === 'linux' ? linuxAvailableBytes() : Promise.resolve(freemem()),
    // Where the weights would land, not where the app is installed: a read-only volume would
    // answer for a disk nothing is ever written to.
    diskFreeBytes: () => statfs(userDataPath).then(stats => stats.bavail * stats.bsize),
    // `complete` rather than `basic`: same four keys, but only `complete` fills `glRenderer`.
    gpuInfo: () => app.getGPUInfo('complete'),
  }
}
