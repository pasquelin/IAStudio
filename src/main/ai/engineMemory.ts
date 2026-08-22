import type { RuntimeOccupancy } from '@shared/domain/aiMemory'
import { runtimeEndpointId, type RuntimeEndpointId } from '@shared/domain/aiRuntime'
import type { EngineDoorMemory } from './pythonProtocol'

/**
 * What the engine reports turned into what `admissionFor` reads.
 *
 * The DOOR is the unit on both sides — `engine/diffusion` is a process, and a process is what a
 * release plan can kill and what actually gives its bytes back.
 */

/** `<runtime>/<door>`, which the engine already speaks. A door it spells otherwise is dropped. */
export function endpointOfDoor(door: string): RuntimeEndpointId | null {
  const [runtime, name, ...rest] = door.split('/')
  if (!runtime || !name || rest.length > 0) return null

  try {
    // `engine/diffusion` is `diffusers/diffusion` — process name vs scheduler key.
    return runtimeEndpointId(runtime === 'engine' ? 'diffusers' : runtime, name)
  } catch {
    return null
  }
}

/** Killing the process returns the bytes (`_worker_left`). Release means death, so no confirmation. */
const RECLAIMABLE = true

export function occupancyOfDoors(
  doors: readonly EngineDoorMemory[],
): Readonly<Record<RuntimeEndpointId, RuntimeOccupancy>> {
  const held: Record<string, RuntimeOccupancy> = {}

  for (const door of doors) {
    const endpoint = endpointOfDoor(door.door)
    // `heldBytes` and not `tensorBytes`: measured 2026-08-22, a generation moved the driver by
    // 5.67 GB while the allocator did not move at all.
    if (endpoint) held[endpoint] = { bytes: door.heldBytes, reclaimable: RECLAIMABLE }
  }

  return held
}
