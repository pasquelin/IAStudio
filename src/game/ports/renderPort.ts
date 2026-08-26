// SPDX-License-Identifier: MIT

import type { Transform } from '@shared/domain/transform'

/** Where one entity of a document stands, once a step has moved it. */
export type EntityPlacement = { entity: string; transform: Transform }

/**
 * What a step hands to whatever draws: one call for every entity that moved, for the reason
 * `InputState` gives. Placing only — what SPAWNS an entity belongs to the world, which has none.
 */
export type RenderPort = {
  place: (moved: readonly EntityPlacement[]) => void
}
