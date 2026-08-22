import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MachineSummary, ModelCandidate } from '@shared/domain/aiOverview'
import type { Compatibility } from '@shared/domain/aiMemory'
import { GIBI, localModel } from '@shared/domain/localModel-fixtures'
import type { FitObstacle } from '@shared/domain/modelFit'
import { useModelFit } from './useModelFit'

/** Four gibibytes once loaded, one on the disk — the gap R3 of ADR-19 is about. */
const MODEL = localModel({ reservationBytes: 4 * GIBI })

const machine = (diskFreeBytes: number | null): MachineSummary => ({
  physicalBytes: 96 * GIBI,
  availableBytes: 6 * GIBI,
  diskFreeBytes,
  gpu: null,
  vram: null,
})

const candidate = (
  fit: Compatibility,
  obstacle: FitObstacle | null,
  installed = true,
): ModelCandidate => ({
  model: MODEL,
  installed,
  loaded: false,
  holdable: true,
  unverified: false,
  supplied: false,
  fit,
  obstacle,
})

const fitFor = (one: ModelCandidate, diskFreeBytes: number | null = 500 * GIBI) =>
  renderHook(() => useModelFit(machine(diskFreeBytes))).result.current(one)

/** `formatBytes` binds its unit with a no-break space, which no assertion should depend on. */
const plain = (text: string): string => text.replace(/\s/g, ' ')

describe('useModelFit', () => {
  it('says how much is asked for and how much is left, rather than only that it is tight', () => {
    expect(plain(fitFor(candidate('slow', 'tight')).verdict)).toBe(
      'lent — 4,0 Gio demandés, 6,0 Gio de mémoire libre',
    )
  })

  /**
   * The verdict is `insufficient-memory` for both, and telling someone to close applications
   * when what is full is their disk sends them to the wrong place.
   */
  it('names the disk when the disk is what is full', () => {
    // A gibibyte to download, and the machine's memory is not what stands in the way.
    expect(plain(fitFor(candidate('insufficient-memory', 'disk'), GIBI / 2).verdict)).toBe(
      'place insuffisante — 1,0 Gio à télécharger, 512 Mio libres sur le disque',
    )
    expect(fitFor(candidate('insufficient-memory', 'memory')).verdict).toMatch(/mémoire/)
  })

  // 🛑 The verdict informs, it never locks — decided 21/08. A model this machine judges badly is
  // still pickable, WITH its reason: what the machine can hold is the person's call.
  it('leaves a badly judged model pickable, and says why it is judged badly', () => {
    const refused = fitFor(candidate('incompatible', 'refused'))

    expect(refused.usable).toBe(true)
    expect(refused.verdict).toMatch(/provenance/)
  })

  // The one thing that still cannot be picked, because there is nothing to pick yet.
  it('leaves a model that is not here unpickable, and says so', () => {
    const missing = fitFor(candidate('compatible', null, false))

    expect(missing.usable).toBe(false)
    expect(missing.note).toMatch(/installer/)
  })

  it('lets an installed model the machine can take be picked, with nothing to add', () => {
    expect(fitFor(candidate('compatible', null))).toEqual({
      verdict: 'compatible',
      note: undefined,
      usable: true,
    })
  })
})
