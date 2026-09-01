import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import type { EnvironmentRef } from '@shared/domain/scene'
import type { EnvironmentDress, SkyboxContent } from '@shared/domain/skybox'
import { litSkyOf, loadSkySource } from '@/stores/skyboxSources'

/**
 * What a scene's environment is worth to it — the port every viewport takes. Synchronous: the open
 * tab, then the copy read off disk, `null` while neither has arrived, with the read fired on the way.
 */
export function environmentDressOf(environment: EnvironmentRef): EnvironmentDress | null {
  if (environment.kind === 'studio') return null
  if (environment.kind === 'skybox') return hung(environment.assetId)

  const sky = litSkyOf(environment.documentId)
  if (sky) return skyDressOf(environment.documentId, sky)

  void loadSkySource(environment.documentId)
  return null
}

/**
 * Asked on every apply of every viewport, and « nothing moved » is told by IDENTITY: the SAME
 * object comes back until one of the four fields differs. Keyed on the content alone, a
 * `showBackground` toggle would cost a shadow pass in every scene naming that sky.
 */
const dresses = new WeakMap<SkyboxContent, EnvironmentDress>()
const pictures = new Map<string, EnvironmentDress>()
/** Per SKY, never one slot for all of them: two viewports on two skies would cancel each other. */
const worn = new Map<string, EnvironmentDress>()

/** A picture hung on its own: no grading, no sun, and the strength the scene alone decides. */
function hung(assetId: string): EnvironmentDress {
  const held = pictures.get(assetId)
  if (held) return held

  const made: EnvironmentDress = {
    assetId,
    adjustments: NEUTRAL_ADJUSTMENTS,
    sun: null,
    intensity: 1,
  }
  pictures.set(assetId, made)
  return made
}

function skyDressOf(documentId: string, sky: SkyboxContent): EnvironmentDress {
  const held = dresses.get(sky)
  if (held) return held

  const made: EnvironmentDress = {
    assetId: sky.source?.assetId ?? null,
    adjustments: sky.adjustments,
    sun: sky.sun,
    intensity: sky.environment.intensity,
  }
  const before = worn.get(documentId)
  const kept = before && same(before, made) ? before : made
  dresses.set(sky, kept)
  worn.set(documentId, kept)
  return kept
}

const same = (a: EnvironmentDress, b: EnvironmentDress): boolean =>
  a.assetId === b.assetId &&
  a.adjustments === b.adjustments &&
  a.sun === b.sun &&
  a.intensity === b.intensity
