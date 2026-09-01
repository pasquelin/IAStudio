import type { RuntimeOccupancy, RuntimeSnapshot } from '@shared/domain/aiMemory'
import type { RuntimeEndpointId } from '@shared/domain/aiRuntime'

/** What a job needs, and where. `needBytes` is a reservation, never a measured peak — R3. */
export type AdmissionRequest = {
  readonly endpoint: RuntimeEndpointId
  readonly needBytes: number
}

export type SchedulerWorld = {
  /** What is WORKING right now, dropped from the candidates before any ordering. */
  readonly active: ReadonlySet<RuntimeEndpointId>
  /** Epoch millis of last use. Absent means never served, which orders first. */
  readonly lastUsedAt: ReadonlyMap<RuntimeEndpointId, number>
}

/** Private on purpose: reachable through `Admission`, and knip refuses a dead export. */
type AdmissionRefusal =
  /** Nothing this machine can free would make the room. Not a queue: a refusal. */
  | 'beyond-machine'
  /** The request asks for a figure that is not a positive count of bytes. */
  | 'not-a-request'
  /** The reading itself is unusable. Blaming the machine for it would be a lie. */
  | 'unusable-reading'

export type Admission =
  | { readonly verdict: 'admit' }
  | {
      readonly verdict: 'release-first'
      /** In the order they should be released, least recently used first. */
      readonly release: readonly RuntimeEndpointId[]
      /**
       * What the plan is EXPECTED to free — an expectation, never added to a reading. Measured
       * wrong by 246 MB on this studio's own viewport, which is why R2 asks for a fresh snapshot.
       */
      readonly expectedFreeBytes: number
    }
  | { readonly verdict: 'refuse'; readonly reason: AdmissionRefusal }

type Candidate = { readonly endpoint: RuntimeEndpointId; readonly bytes: number }

/**
 * Whose bytes a plan may count on: reclaimable, holding something, and not working right now.
 *
 * The door being loaded onto is deliberately NOT excluded — unloading what it already holds is how
 * it makes room for the next model.
 */
function candidatesOf(snapshot: RuntimeSnapshot, world: SchedulerWorld): readonly Candidate[] {
  // The one cast of this module: `Object.entries` widens a branded key back to `string`.
  const entries = Object.entries(snapshot.runtimeBytes) as [RuntimeEndpointId, RuntimeOccupancy][]

  return entries
    .filter(
      ([endpoint, occupancy]) =>
        occupancy.reclaimable && occupancy.bytes > 0 && !world.active.has(endpoint),
    )
    .map(([endpoint, occupancy]) => ({ endpoint, bytes: occupancy.bytes }))
}

/**
 * Least recently used first; never used before ever used; largest first at equal age, so a plan
 * releases as few doors as it can.
 *
 * COMPARED, never subtracted: a sentinel for "never used" would be `-Infinity`, and subtracting it
 * from itself is `NaN` — the same defect as pricing an active resource at infinity, in disguise.
 */
function byLeastRecentlyUsed(world: SchedulerWorld): (a: Candidate, b: Candidate) => number {
  return (a, b) => {
    const left = world.lastUsedAt.get(a.endpoint)
    const right = world.lastUsedAt.get(b.endpoint)

    if (left === right) return b.bytes - a.bytes
    if (left === undefined) return -1
    if (right === undefined) return 1
    return left < right ? -1 : 1
  }
}

/**
 * Whether a job fits, and what to release first if it does not.
 *
 * Takes a `RuntimeSnapshot`: R1 says a probe reading may never admit a job, so asking for the
 * narrowed type stops a probe from being passed at all. It never mutates and never subtracts from
 * a past reading — it answers a PLAN, and R2 leaves the caller to ask for a fresh snapshot.
 */
export function admissionFor(
  snapshot: RuntimeSnapshot,
  request: AdmissionRequest,
  world: SchedulerWorld,
): Admission {
  if (!Number.isFinite(request.needBytes) || request.needBytes <= 0) {
    return { verdict: 'refuse', reason: 'not-a-request' }
  }

  // Guarded on the same line as the request: an infinite reading would admit a job the machine
  // cannot hold, and a `NaN` one would blame the machine for a broken snapshot.
  if (!Number.isFinite(snapshot.availableBytes) || snapshot.availableBytes < 0) {
    return { verdict: 'refuse', reason: 'unusable-reading' }
  }

  if (snapshot.availableBytes >= request.needBytes) return { verdict: 'admit' }

  const missing = request.needBytes - snapshot.availableBytes
  const ordered = [...candidatesOf(snapshot, world)].sort(byLeastRecentlyUsed(world))

  const release: RuntimeEndpointId[] = []
  let expectedFreeBytes = 0

  for (const candidate of ordered) {
    if (expectedFreeBytes >= missing) break
    release.push(candidate.endpoint)
    expectedFreeBytes += candidate.bytes
  }

  return expectedFreeBytes >= missing
    ? { verdict: 'release-first', release, expectedFreeBytes }
    : { verdict: 'refuse', reason: 'beyond-machine' }
}
