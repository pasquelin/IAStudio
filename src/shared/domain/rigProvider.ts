/**
 * Which services can put a skeleton in a mesh, and why one of them cannot be used right now.
 *
 * The studio's own rigger is not in this list and never will be: it is free, offline and
 * immediate, so it is what « Automatic » picks and what stays available when everything here is
 * out of reach. Scenario is one provider more — measured, not assumed: on a `cu-basic` account
 * all six answer 403 `ModelAccessRestrictedError`.
 *
 * Shared rather than kept in the main process because both sides read it: the catalogue is
 * fetched there, and the inspector is what has to grey a row out BEFORE it is clicked.
 */
import type { ModelSummary } from './model'
import { isBeyondPlan, type PlanAccess } from './plan'

/** What every 3D-to-3D model of the platform answers. It is the coarse half of the question. */
const RIG_CAPABILITY = '3d23d'

/**
 * The fine half, and the reason it is needed: MEASURED on 2026-08-18, `3d23d` covers 19 public
 * models and only five of them rig — the rest remesh, retexture, unwrap, segment or animate.
 *
 * An author's word rather than a namespaced `sc:` claim, so it is not contractual; it is
 * nonetheless the only signal there is, and the catalogue is still what answers. Compared
 * case-insensitively: the five spell it `Rigging`, their neighbours spell theirs in every case.
 */
const RIG_TAG = 'rigging'

export type RigProvider = {
  modelId: string
  name: string
  /** The plan grade the API refuses it below, when it grades it at all. */
  requiredPlanLevel?: number
}

/** Why a provider cannot run right now, or nothing. Each is a sentence the caller has to say. */
export type RigRefusal = { kind: 'plan' } | { kind: 'too-large'; maxSize: number }

/**
 * The riggers the catalogue holds, in the order it answered — its own relevance.
 *
 * Never a list written out in code: a provider added next quarter has to appear without a
 * release, and one withdrawn has to stop being offered.
 */
export function rigProvidersOf(models: readonly ModelSummary[]): RigProvider[] {
  return models.filter(model => isRigger(model)).map(asProvider)
}

/**
 * The models that MAKE a motion, as opposed to putting a skeleton in a mesh.
 *
 * MEASURED on 2026-08-18, and counted ON SCREEN rather than from the catalogue dump — which is
 * how the count was WRONG first: SIX carry `Motion` or `Animation` and no `Rigging`. Three
 * Uthana and not two, the deprecated `text-to-motion-bucmd` being still listed, plus the two
 * Cartwheel and Meshy's animator. The `Rigging` half of the test keeps `tripo-rigging-v2-5`
 * out, which carries `Animation` as well and rigs.
 *
 * The capability is deliberately NOT read: these span `txt23d`, `video23d` and `3d23d`, and a
 * list built on it would be either three quarters wrong or a list of everything.
 */
export function motionProvidersOf(models: readonly ModelSummary[]): RigProvider[] {
  return models
    .filter(model => !isRigger(model) && ownsTag(model.tags, MOTION_TAGS))
    .map(asProvider)
}

const MOTION_TAGS: readonly string[] = ['motion', 'animation']

function isRigger(model: ModelSummary): boolean {
  return model.capabilities.includes(RIG_CAPABILITY) && ownsTag(model.tags, [RIG_TAG])
}

function asProvider({ id, name, requiredPlanLevel }: ModelSummary): RigProvider {
  return { modelId: id, name, requiredPlanLevel }
}

/**
 * Why this provider cannot be used, or nothing — asked before the click, never after the upload.
 *
 * The plan comes first because it costs nothing to check and refuses outright; the size is only
 * worth saying to someone the plan would let through. `bytes` of `0` means « not weighed yet »,
 * which refuses nothing: a mesh still being exported must not read as one that fits.
 */
export function rigRefusalOf(
  provider: RigProvider,
  plan: PlanAccess | null,
  mesh: { bytes: number; maxSize?: number },
): RigRefusal | null {
  if (isBeyondPlan(provider.requiredPlanLevel, plan)) return { kind: 'plan' }
  if (mesh.maxSize === undefined || mesh.bytes <= mesh.maxSize) return null

  return { kind: 'too-large', maxSize: mesh.maxSize }
}

function ownsTag(tags: readonly string[], wanted: readonly string[]): boolean {
  return tags.some(tag => wanted.includes(tag.toLowerCase()))
}
