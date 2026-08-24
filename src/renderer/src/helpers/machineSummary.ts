import type { MachineSummary } from '@shared/domain/aiOverview'

/**
 * The chip, out of what the probe could read. Chromium answers
 * `ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Version 26.5.2 (Build 25F84))` — measured on
 * this Mac, 2026-08-21 — and a line of a settings screen has no room for the build of a driver.
 */
export function gpuName(renderer: string): string {
  const named = /:\s*([^,)]+)/.exec(renderer)

  return renderer.startsWith('ANGLE (') && named?.[1] ? named[1].trim() : renderer
}

/**
 * What the machine offers, in one line — memory, chip, video memory, disk. A part the machine
 * did not answer is dropped rather than filled in.
 *
 * Every figure NAMES its subject. Read as bare numbers it was « 75 Gio libres sur 96 · Apple M2
 * Max · 78 Gio libres sur 78 · 272 Gio », where nothing said which memory was which.
 *
 * 🛑 `!summary.vram` and not `=== null`: the type says `| null`, but this crosses IPC and a
 * summary written before the field existed has no key at all — measured, it took the manager
 * down with `Cannot read properties of undefined (reading 'totalBytes')`.
 */
export function machineReadings(
  summary: MachineSummary,
  translate: (key: string, values: Record<string, string>) => string,
  bytes: (value: number) => string,
): string[] {
  return [
    translate('aiModels.machineMemory', {
      total: bytes(summary.physicalBytes),
      available: bytes(summary.availableBytes),
    }),
    summary.gpu === null ? null : translate('aiModels.machineGpu', { name: gpuName(summary.gpu) }),
    // The video memory when a runtime answered for it, and nothing at all otherwise: a machine
    // with a dedicated card is judged on THIS figure, so leaving it unsaid would hide the reason.
    !summary.vram
      ? null
      : translate('aiModels.machineVram', {
          total: bytes(summary.vram.totalBytes),
          free: bytes(summary.vram.freeBytes),
        }),
    summary.diskFreeBytes === null
      ? null
      : translate('aiModels.machineDisk', { free: bytes(summary.diskFreeBytes) }),
  ].filter(part => part !== null)
}

/** The same readings on one line, for a surface with room for one and not for four. */
export function machineSummary(
  summary: MachineSummary,
  translate: (key: string, values: Record<string, string>) => string,
  bytes: (value: number) => string,
): string {
  return machineReadings(summary, translate, bytes).join(' · ')
}
