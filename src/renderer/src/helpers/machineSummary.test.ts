import { describe, expect, it } from 'vitest'
import type { MachineSummary } from '@shared/domain/aiOverview'
import { GIBI } from '@shared/domain/localModel-fixtures'
import { gpuName, machineSummary } from './machineSummary'

const machine = (over: Partial<MachineSummary> = {}): MachineSummary => ({
  physicalBytes: 96 * GIBI,
  availableBytes: 34 * GIBI,
  diskFreeBytes: 500 * GIBI,
  gpu: 'Apple M2 Max',
  vram: null,
  ...over,
})

const say = (key: string, values: Record<string, string>): string =>
  `${key}(${Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join(',')})`

const bytes = (value: number): string => `${Math.round(value / GIBI)}G`

describe('gpuName', () => {
  // What `app.getGPUInfo` answered on this Mac, 2026-08-21. Read whole, the line of the manager
  // was three quarters driver build.
  it('takes the chip out of what Chromium answers', () => {
    expect(
      gpuName('ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Version 26.5.2 (Build 25F84))'),
    ).toBe('Apple M2 Max')
  })

  // A machine that answered something else answered it for a reason: it is shown as it came.
  it('hands back anything that is not shaped like that', () => {
    expect(gpuName('NVIDIA GeForce RTX 4090')).toBe('NVIDIA GeForce RTX 4090')
  })
})

describe('the machine sentence', () => {
  it('says memory, chip and disk, in that order', () => {
    expect(machineSummary(machine(), say, bytes)).toBe(
      'aiModels.machineMemory(total=96G,available=34G) · Apple M2 Max · aiModels.machineDisk(free=500G)',
    )
  })

  it('adds the video memory only where a runtime answered for it', () => {
    const said = machineSummary(
      machine({ vram: { totalBytes: 24 * GIBI, freeBytes: 20 * GIBI } }),
      say,
      bytes,
    )

    expect(said).toContain('aiModels.machineVram(total=24G,free=20G)')
  })

  it('drops what the machine did not answer rather than saying nothing about it', () => {
    expect(machineSummary(machine({ gpu: null, diskFreeBytes: null }), say, bytes)).toBe(
      'aiModels.machineMemory(total=96G,available=34G)',
    )
  })

  /**
   * A summary written by a version that had no `vram` key crosses IPC without one, and the type
   * cannot see it. Reading `.totalBytes` off that took the manager down.
   */
  it('survives a summary that predates the video memory reading', () => {
    const older: Record<string, unknown> = { ...machine() }
    delete older.vram

    expect(() => machineSummary(older as unknown as MachineSummary, say, bytes)).not.toThrow()
  })
})
