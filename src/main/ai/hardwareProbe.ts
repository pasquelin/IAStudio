import type { MemoryDomain, MemorySnapshot } from '@shared/domain/aiMemory'
import { isRecord } from '@shared/guards'

/** What a probe can say about the GPU. Nothing about its memory — see `gpuIdentityOf`. */
export type GpuIdentity = {
  readonly vendorId: number | null
  readonly deviceId: number | null
  /** `ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, …)` — a name, never a capacity. */
  readonly renderer: string | null
  readonly machineModel: string | null
}

export type HardwareFacts = {
  readonly platform: NodeJS.Platform
  readonly arch: string
  /** Raw. Reserving cores for the interface is a policy, and policies are not the probe's. */
  readonly cpuCount: number
  readonly physicalBytes: number
  /**
   * What the port could establish is free RIGHT NOW, and it is the softest figure here.
   *
   * Measured 2026-08-21 on this Mac: `os.freemem()` answered 29.51 GB — free plus speculative
   * pages — while 31.58 GB sat in reclaimable inactive pages it does not count. A port is expected
   * to do better where it can, and `null` when it cannot.
   */
  readonly freeBytes: number | null
  /** `null` when the path could not be stat'd; a probe reports absence rather than guessing zero. */
  readonly diskFreeBytes: number | null
  readonly gpu: GpuIdentity | null
}

/**
 * Every machine reading the probe is allowed, injected.
 *
 * Measured 2026-08-20: a `platform = process.platform` default let three tests assert the macOS
 * tree and go red on the CI runner. Passing it is what makes the compiler ask.
 */
export type HardwarePort = {
  platform: () => NodeJS.Platform
  arch: () => string
  cpuCount: () => number
  totalBytes: () => number
  availableBytes: () => Promise<number | null>
  diskFreeBytes: () => Promise<number | null>
  /** `app.getGPUInfo`. Typed `unknown` by Electron itself, so it is narrowed rather than trusted. */
  gpuInfo: () => Promise<unknown>
}

const record = (value: unknown): Record<string, unknown> | null => (isRecord(value) ? value : null)

const numberAt = (source: Record<string, unknown> | null, key: string): number | null =>
  typeof source?.[key] === 'number' ? source[key] : null

const stringAt = (source: Record<string, unknown> | null, key: string): string | null =>
  typeof source?.[key] === 'string' ? source[key] : null

/**
 * Reads what `getGPUInfo` actually returns, and nothing more: `electron.d.ts` types the call
 * `Promise<unknown>` and declares no GPU-memory field, so nothing here may assume a shape.
 *
 * With no device flagged active, the first is taken — on a dual-GPU laptop that is the integrated
 * one, which under-promises rather than over-promises.
 */
export function gpuIdentityOf(info: unknown): GpuIdentity | null {
  const root = record(info)
  if (!root) return null

  const devices = Array.isArray(root.gpuDevice) ? root.gpuDevice : []
  const active = record(devices.find(device => record(device)?.active === true) ?? devices[0])

  return {
    vendorId: numberAt(active, 'vendorId'),
    deviceId: numberAt(active, 'deviceId'),
    renderer: stringAt(record(root.auxAttributes), 'glRenderer'),
    machineModel: stringAt(root, 'machineModelName'),
  }
}

/**
 * `[D]` Apple Silicon is unified, everything else is assumed split — a DEDUCTION from platform and
 * architecture, not a reading. A `split` machine has video memory this snapshot has no field for.
 */
export function memoryDomainOf(platform: NodeJS.Platform, arch: string): MemoryDomain {
  return platform === 'darwin' && arch === 'arm64' ? 'unified' : 'split'
}

/** The probe holds the "absence rather than a guess" policy for both readings that may fail. */
export async function hardwareProbe(port: HardwarePort): Promise<HardwareFacts> {
  const [availableBytes, diskFreeBytes, info] = await Promise.all([
    port.availableBytes().catch(() => null),
    port.diskFreeBytes().catch(() => null),
    port.gpuInfo().catch(() => null),
  ])

  return {
    platform: port.platform(),
    arch: port.arch(),
    cpuCount: port.cpuCount(),
    physicalBytes: port.totalBytes(),
    freeBytes: availableBytes,
    diskFreeBytes,
    gpu: gpuIdentityOf(info),
  }
}

/** The thresholds ADR-19 leaves undecided. Passed in, never chosen here. */
export type ProbeBudget = {
  readonly appBudgetBytes: number
  readonly headroomBytes: number
  readonly rendererReservedBytes: number
}

/**
 * A snapshot that may sort a catalogue and explain a refusal, and that ADMITS NOTHING — R1.
 *
 * The `source: 'probe'` narrowing is carried in the TYPE so an admission rule can demand
 * `{ source: 'runtime' }` and have R1 redden at the typecheck, the way `readonly` carries R2.
 */
export type ProbeSnapshot = MemorySnapshot & { readonly source: 'probe' }

/**
 * `rendererReservedBytes` comes off the BUDGET alone: the budget is gross, while a free-memory
 * reading is a residue the window is already out of. Taking it off both counted it twice.
 */
export function probeSnapshot(
  facts: HardwareFacts,
  budget: ProbeBudget,
  at: number,
): ProbeSnapshot {
  const allowed = budget.appBudgetBytes - budget.rendererReservedBytes

  return {
    domain: memoryDomainOf(facts.platform, facts.arch),
    source: 'probe',
    at,
    physicalBytes: facts.physicalBytes,
    appBudgetBytes: budget.appBudgetBytes,
    rendererReservedBytes: budget.rendererReservedBytes,
    runtimeBytes: {},
    headroomBytes: budget.headroomBytes,
    availableBytes: Math.max(
      0,
      Math.min(allowed, facts.freeBytes ?? allowed) - budget.headroomBytes,
    ),
  }
}
