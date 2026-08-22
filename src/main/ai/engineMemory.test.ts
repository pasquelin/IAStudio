import { describe, expect, it } from 'vitest'
import { runtimeEndpointId } from '@shared/domain/aiRuntime'
import { endpointOfDoor, occupancyOfDoors } from './engineMemory'
import type { EngineDoorMemory } from './pythonProtocol'

const diffusion: EngineDoorMemory = {
  door: 'engine/diffusion',
  tensorBytes: 8_844_678_144,
  heldBytes: 8_890_220_544,
  device: 'mps',
  backend: 'pytorch',
}

describe('the door the engine names', () => {
  it('is the endpoint the scheduler keys its bytes by', () => {
    expect(endpointOfDoor('engine/diffusion')).toBe(runtimeEndpointId('engine', 'diffusion'))
  })

  /** A key not minted here fails to index `runtimeBytes`, so a bad spelling is dropped, not cast. */
  it('is nothing when the engine spelt it another way', () => {
    for (const door of ['engine', 'engine/diffusion/extra', 'Engine/Diffusion', '']) {
      expect(endpointOfDoor(door)).toBeNull()
    }
  })
})

describe('what a release plan may count on', () => {
  /**
   * Measured 2026-08-22: a generation moved the driver by 5.67 GB while the allocator did not move
   * at all. Reading tensors would under-report a door mid-generation by two thirds.
   */
  it('counts what was taken from the pot, not what the tensors weigh', () => {
    const [held] = Object.values(occupancyOfDoors([diffusion]))

    expect(held?.bytes).toBe(8_890_220_544)
  })

  /** Releasing a door is killing its process, and a dead process gives everything back. */
  it('reads a door as reclaimable', () => {
    expect(Object.values(occupancyOfDoors([diffusion]))[0]?.reclaimable).toBe(true)
  })

  it('keys each door apart', () => {
    const held = occupancyOfDoors([diffusion, { ...diffusion, door: 'engine/audio', heldBytes: 7 }])

    expect(Object.keys(held).sort()).toEqual(['engine/audio', 'engine/diffusion'])
  })

  /** A door that never answered is absent from the ledger, and absent is what reads `unknown`. */
  it('is empty when no door answered', () => {
    expect(occupancyOfDoors([])).toEqual({})
  })

  it('drops a door whose name it could not read rather than inventing a key', () => {
    expect(occupancyOfDoors([{ ...diffusion, door: 'engine' }])).toEqual({})
  })
})
