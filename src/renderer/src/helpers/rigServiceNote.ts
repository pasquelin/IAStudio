import type { TFunction } from 'i18next'
import type { PlanAccess } from '@shared/domain/plan'
import { rigRefusalOf, type RigProvider } from '@shared/domain/rigProvider'

/**
 * What one Scenario service says under its own name: why it cannot run, or that it is coming.
 *
 * Two screens offer these services — the rig section and the picker's AI tab — and a sentence
 * written twice is a sentence that ends up saying two different things.
 */
export function rigServiceNote(
  provider: RigProvider,
  plan: PlanAccess | null,
  mesh: { bytes: number; maxSize?: number },
  t: TFunction,
): string {
  return rigRefusalOf(provider, plan, mesh)
    ? t('inspector.animationAiLocked', { plan: plan?.name ?? '' })
    : t('inspector.animationAiSoon')
}
