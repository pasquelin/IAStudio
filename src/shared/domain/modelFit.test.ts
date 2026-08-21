import { describe, expect, it } from 'vitest'
import type { MemorySnapshot, MemorySource } from './aiMemory'
import type { LocalModel } from './localModel'
import { fitAllowsUse, fitOf, type MachineOffer } from './modelFit'

const GIGA = 1_000_000_000

const snapshot = (availableBytes: number, source: MemorySource = 'runtime'): MemorySnapshot => ({
  domain: 'unified',
  source,
  at: 0,
  physicalBytes: 100 * GIGA,
  appBudgetBytes: 50 * GIGA,
  rendererReservedBytes: GIGA,
  runtimeBytes: {},
  headroomBytes: 2 * GIGA,
  availableBytes,
})

const model = (over: Partial<LocalModel> = {}): LocalModel => ({
  id: 'llama',
  title: 'Llama 3.2 3B',
  format: 'gguf',
  loader: 'ollama',
  rank: 1,
  licence: 'LLAMA-3.2',
  licenceUrl: 'https://example.invalid/licence',
  source: 'https://example.invalid/model',
  files: [{ role: 'weights', name: 'w.gguf', url: 'https://x/w', bytes: 2 * GIGA, sha256: 'a' }],
  reservationBytes: 4 * GIGA,
  ...over,
})

const offer = (over: Partial<MachineOffer> = {}): MachineOffer => ({
  snapshot: snapshot(40 * GIGA),
  diskFreeBytes: 300 * GIGA,
  installed: false,
  ...over,
})

describe('fitOf', () => {
  it('calls a model compatible when the runtime answered and there is room to spare', () => {
    expect(fitOf(model(), offer())).toBe('compatible')
  })

  // R1: a probe reading sorts a catalogue and explains a refusal, and never admits a job — so it
  // can never answer `compatible` either. `unknown` is the honest reading, not a failure.
  it('answers unknown when no runtime answered', () => {
    expect(fitOf(model(), offer({ snapshot: snapshot(40 * GIGA, 'probe') }))).toBe('unknown')
    expect(fitOf(model(), offer({ snapshot: snapshot(40 * GIGA, 'none') }))).toBe('unknown')
  })

  it('refuses a model the whitelist does not admit, whatever the machine has', () => {
    expect(fitOf(model({ format: 'pickle' }), offer())).toBe('incompatible')
  })

  it('refuses a model that does not fit in memory', () => {
    expect(fitOf(model({ reservationBytes: 50 * GIGA }), offer())).toBe('insufficient-memory')
  })

  // The reservation is a floor, never the peak (R3), so the margin above it is what the job has
  // to grow into. Past two thirds it runs, and it hurts.
  it('warns rather than refuses when the margin is thin', () => {
    expect(fitOf(model({ reservationBytes: 30 * GIGA }), offer())).toBe('slow')
  })

  // Disk before memory, and only when the model is not already here: what cannot land cannot run.
  it('refuses a model the disk cannot take', () => {
    expect(fitOf(model(), offer({ diskFreeBytes: GIGA }))).toBe('insufficient-memory')
  })

  it('ignores the disk for a model already installed', () => {
    expect(fitOf(model(), offer({ diskFreeBytes: 0, installed: true }))).toBe('compatible')
  })

  // A probe reports absence rather than guessing zero, and absence must not read as "no space".
  it('does not refuse on a disk reading it could not take', () => {
    expect(fitOf(model(), offer({ diskFreeBytes: null }))).toBe('compatible')
  })
})

describe('fitAllowsUse', () => {
  // `slow` runs and warns. Only a hard no keeps the model out of reach.
  it('lets everything through but a hard no', () => {
    expect(fitAllowsUse('compatible')).toBe(true)
    expect(fitAllowsUse('slow')).toBe(true)
    expect(fitAllowsUse('unknown')).toBe(true)
    expect(fitAllowsUse('insufficient-memory')).toBe(false)
    expect(fitAllowsUse('incompatible')).toBe(false)
  })
})
