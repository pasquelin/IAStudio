import { describe, expect, it } from 'vitest'
import {
  gpuIdentityOf,
  hardwareProbe,
  memoryDomainOf,
  probeSnapshot,
  type HardwareFacts,
  type HardwarePort,
} from './hardwareProbe'

/** What `app.getGPUInfo('complete')` actually answered here on 2026-08-21, Electron 43.4.0. */
const REAL_GPU_INFO = {
  auxAttributes: {
    glRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Version 26.5.2)',
    glVendor: 'Google Inc. (Apple)',
    inProcessGpu: false,
  },
  gpuDevice: [{ active: true, deviceId: 0, gpuPreference: 0, vendorId: 4203 }],
  machineModelName: 'Mac',
  machineModelVersion: '14.6',
}

/** Round figures, chosen for arithmetic that reads — unlike `REAL_GPU_INFO`, nothing here is measured. */
const port = (over: Partial<HardwarePort> = {}): HardwarePort => ({
  platform: () => 'linux',
  arch: () => 'x64',
  cpuCount: () => 12,
  totalBytes: () => 100_000_000_000,
  availableBytes: () => Promise.resolve(60_000_000_000),
  diskFreeBytes: () => Promise.resolve(310_000_000_000),
  gpuInfo: () => Promise.resolve(REAL_GPU_INFO),
  ...over,
})

const facts = (over: Partial<HardwareFacts> = {}): HardwareFacts => ({
  platform: 'darwin',
  arch: 'arm64',
  cpuCount: 12,
  physicalBytes: 100_000_000_000,
  freeBytes: 60_000_000_000,
  diskFreeBytes: 310_000_000_000,
  gpu: null,
  ...over,
})

describe('hardwareProbe', () => {
  // The port answers `linux`, so a test cannot pass by inheriting the Mac it was written on.
  it('reports the machine the port describes, not the one it runs on', async () => {
    await expect(hardwareProbe(port())).resolves.toMatchObject({
      platform: 'linux',
      arch: 'x64',
      cpuCount: 12,
      physicalBytes: 100_000_000_000,
      diskFreeBytes: 310_000_000_000,
    })
  })

  // A probe that invented a zero would read as "no room left" and refuse every model.
  it('reports a reading it could not take as absent rather than as zero', async () => {
    await expect(
      hardwareProbe(
        port({
          availableBytes: () => Promise.resolve(null),
          diskFreeBytes: () => Promise.reject(new Error('ENOENT')),
        }),
      ),
    ).resolves.toMatchObject({ freeBytes: null, diskFreeBytes: null })
  })

  it('still answers when a reading rejects outright', async () => {
    const probed = await hardwareProbe(port({ gpuInfo: () => Promise.reject(new Error('no gpu')) }))

    expect(probed.gpu).toBeNull()
    expect(probed.physicalBytes).toBe(100_000_000_000)
  })
})

describe('gpuIdentityOf', () => {
  it('reads the answer this machine really gave', () => {
    expect(gpuIdentityOf(REAL_GPU_INFO)).toEqual({
      vendorId: 4203,
      deviceId: 0,
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Version 26.5.2)',
      machineModel: 'Mac',
    })
  })

  // Electron declares no shape at all, so every field is optional in practice — a missing one
  // reads as unknown, never as a number.
  it('answers null fields rather than throwing on a shape it was not promised', () => {
    expect(gpuIdentityOf({})).toEqual({
      vendorId: null,
      deviceId: null,
      renderer: null,
      machineModel: null,
    })
    expect(gpuIdentityOf(null)).toBeNull()
    expect(gpuIdentityOf('not an object')).toBeNull()
  })

  it('takes the active device when the machine lists several', () => {
    expect(
      gpuIdentityOf({
        gpuDevice: [
          { active: false, vendorId: 1, deviceId: 1 },
          { active: true, vendorId: 2, deviceId: 2 },
        ],
      }),
    ).toMatchObject({ vendorId: 2, deviceId: 2 })
  })
})

describe('memoryDomainOf', () => {
  it('calls Apple Silicon unified and everything else split', () => {
    expect(memoryDomainOf('darwin', 'arm64')).toBe('unified')
    expect(memoryDomainOf('darwin', 'x64')).toBe('split')
    expect(memoryDomainOf('win32', 'x64')).toBe('split')
    expect(memoryDomainOf('linux', 'arm64')).toBe('split')
  })
})

describe('probeSnapshot', () => {
  const budget = {
    appBudgetBytes: 40_000_000_000,
    headroomBytes: 2_000_000_000,
    rendererReservedBytes: 500_000_000,
  }

  // R1: a probe sorts a catalogue and explains a refusal. It may never admit a job, and `source`
  // is what says so — no runtime answered, so nothing here is an occupation.
  it('answers as a probe holding no runtime', () => {
    const snapshot = probeSnapshot(facts(), budget, 1_700_000_000_000)

    expect(snapshot.source).toBe('probe')
    expect(snapshot.runtimeBytes).toEqual({})
    expect(snapshot.at).toBe(1_700_000_000_000)
  })

  it('takes the machine domain from the facts it was handed', () => {
    expect(probeSnapshot(facts(), budget, 0).domain).toBe('unified')
    expect(probeSnapshot(facts({ platform: 'win32', arch: 'x64' }), budget, 0).domain).toBe('split')
  })

  // The window comes off the BUDGET, which is gross — never off a free-memory reading, which is a
  // residue the window is already out of. Taking it off both counted it twice.
  it('offers the budget less the window and the headroom', () => {
    expect(probeSnapshot(facts(), budget, 0).availableBytes).toBe(37_500_000_000)
  })

  // The budget is a ceiling, not an entitlement: a machine with less free than that wins.
  it('never offers more than the machine actually has free', () => {
    expect(probeSnapshot(facts({ freeBytes: 3_000_000_000 }), budget, 0).availableBytes).toBe(
      1_000_000_000,
    )
  })

  // A port that could not read free memory must not make the probe refuse everything: the budget
  // then stands alone, which is the honest reading of "we know what we allow, not what is left".
  it('falls back to the budget when free memory could not be read', () => {
    expect(probeSnapshot(facts({ freeBytes: null }), budget, 0).availableBytes).toBe(37_500_000_000)
  })

  // Refusing is an answer; a negative figure would be read as a number and budgeted.
  it('answers zero rather than a negative when the reserves exceed what is free', () => {
    expect(probeSnapshot(facts({ freeBytes: 1_000_000_000 }), budget, 0).availableBytes).toBe(0)
  })
})
