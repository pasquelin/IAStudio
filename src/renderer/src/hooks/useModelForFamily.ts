import { primaryRoleOf } from '@shared/domain/aiRole'
import type { ModelFamily } from '@shared/domain/model'
import { useModelForCapability } from './useModelForCapability'

/**
 * The model a family generates with, for the surfaces that still name one rather than an
 * operation — the rail deciding whether to draw the generator, and the canvas edits.
 *
 * Its FIRST employment answers, which is what `CAPABILITIES_BY_FAMILY` declares first. `null` for
 * the home, which browses no catalogue, and for `other`, which generates nothing.
 */
export function useModelForFamily(family: ModelFamily | null): string | null {
  return useModelForCapability(family === null ? null : primaryRoleOf(family))
}
