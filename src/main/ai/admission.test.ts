import { describe, expect, it } from 'vitest'
import type { RuntimeSnapshot } from '@shared/domain/aiMemory'
import { runtimeEndpointId } from '@shared/domain/aiRuntime'
import { admissionFor, type SchedulerWorld } from './admission'

const OLLAMA = runtimeEndpointId('ollama', 'api-chat')
const V1 = runtimeEndpointId('ollama', 'v1-chat')
const LLAMACPP = runtimeEndpointId('llamacpp', 'embedded')

const GIGA = 1_000_000_000

const held = (bytes: number, reclaimable = true) => ({ bytes, reclaimable })

const snapshot = (
  availableBytes: number,
  runtimeBytes: RuntimeSnapshot['runtimeBytes'] = {},
): RuntimeSnapshot => ({
  domain: 'unified',
  source: 'runtime',
  at: 1_700_000_000_000,
  physicalBytes: 100 * GIGA,
  appBudgetBytes: 50 * GIGA,
  rendererReservedBytes: GIGA,
  runtimeBytes,
  headroomBytes: 2 * GIGA,
  availableBytes,
})

const world = (over: Partial<SchedulerWorld> = {}): SchedulerWorld => ({
  active: new Set(),
  lastUsedAt: new Map(),
  ...over,
})

describe('admissionFor', () => {
  it('admits a job the free room already covers', () => {
    expect(
      admissionFor(snapshot(10 * GIGA), { endpoint: OLLAMA, needBytes: 4 * GIGA }, world()),
    ).toEqual({ verdict: 'admit' })
  })

  it('refuses what cannot be a request', () => {
    for (const needBytes of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(admissionFor(snapshot(10 * GIGA), { endpoint: OLLAMA, needBytes }, world())).toEqual({
        verdict: 'refuse',
        reason: 'not-a-request',
      })
    }
  })

  // A reading that is not a usable count of bytes is the READING's fault, and saying
  // `beyond-machine` would blame the machine for it.
  it('refuses a reading it cannot use, without blaming the machine', () => {
    for (const availableBytes of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(
        admissionFor(snapshot(availableBytes), { endpoint: OLLAMA, needBytes: GIGA }, world()),
      ).toEqual({ verdict: 'refuse', reason: 'unusable-reading' })
    }
  })

  it('admits a job that fits exactly', () => {
    expect(
      admissionFor(snapshot(4 * GIGA), { endpoint: OLLAMA, needBytes: 4 * GIGA }, world()),
    ).toEqual({ verdict: 'admit' })
  })

  it('plans a release when the room is short but reachable', () => {
    const plan = admissionFor(
      snapshot(GIGA, { [V1]: held(5 * GIGA) }),
      { endpoint: OLLAMA, needBytes: 4 * GIGA },
      world(),
    )

    expect(plan).toEqual({ verdict: 'release-first', release: [V1], expectedFreeBytes: 5 * GIGA })
  })

  // Releasing a door that holds nothing kills a warm process for zero bytes. A door at 0 is
  // typically one that never served, so it would sort FIRST and land in almost every plan.
  it('never releases a door that holds nothing', () => {
    const plan = admissionFor(
      snapshot(GIGA, { [LLAMACPP]: held(0), [V1]: held(5 * GIGA) }),
      { endpoint: OLLAMA, needBytes: 4 * GIGA },
      world(),
    )

    expect(plan).toMatchObject({ release: [V1] })
  })

  // At equal age the largest goes first, or a plan takes two doors where one sufficed.
  it('releases as few doors as it can when ages tie', () => {
    const plan = admissionFor(
      snapshot(0, { [V1]: held(3 * GIGA), [LLAMACPP]: held(5 * GIGA) }),
      { endpoint: OLLAMA, needBytes: 4 * GIGA },
      world({
        lastUsedAt: new Map([
          [V1, 1_000],
          [LLAMACPP, 1_000],
        ]),
      }),
    )

    expect(plan).toMatchObject({ release: [LLAMACPP], expectedFreeBytes: 5 * GIGA })
  })

  it('refuses when even releasing everything would not make the room', () => {
    expect(
      admissionFor(
        snapshot(GIGA, { [V1]: held(2 * GIGA) }),
        { endpoint: OLLAMA, needBytes: 40 * GIGA },
        world(),
      ),
    ).toEqual({ verdict: 'refuse', reason: 'beyond-machine' })
  })

  // The whole point of `reclaimable` being two-armed: bytes nobody confirmed came back may not be
  // counted on, so a plan that needed them is a refusal rather than an optimistic promise.
  it('never counts on bytes that are not reclaimable', () => {
    expect(
      admissionFor(
        snapshot(GIGA, { [V1]: held(50 * GIGA, false) }),
        { endpoint: OLLAMA, needBytes: 4 * GIGA },
        world(),
      ),
    ).toEqual({ verdict: 'refuse', reason: 'beyond-machine' })
  })

  // Measured cost of the alternative: an ACTIVE resource priced at infinity makes the score NaN
  // the moment a weight is zero, and NaN compares false against everything — so the worst
  // candidate wins the sort. It is dropped from the candidates instead, before any ordering.
  it('never releases what is working right now', () => {
    expect(
      admissionFor(
        snapshot(GIGA, { [V1]: held(50 * GIGA) }),
        { endpoint: OLLAMA, needBytes: 4 * GIGA },
        world({ active: new Set([V1]) }),
      ),
    ).toEqual({ verdict: 'refuse', reason: 'beyond-machine' })
  })

  it('releases the least recently used first', () => {
    const plan = admissionFor(
      snapshot(0, { [V1]: held(3 * GIGA), [LLAMACPP]: held(3 * GIGA) }),
      { endpoint: OLLAMA, needBytes: 2 * GIGA },
      world({
        lastUsedAt: new Map([
          [V1, 2_000],
          [LLAMACPP, 1_000],
        ]),
      }),
    )

    expect(plan).toMatchObject({ release: [LLAMACPP] })
  })

  // An endpoint nobody has ever used has no reason to be kept over one that just served.
  it('releases what never served before what has', () => {
    const plan = admissionFor(
      snapshot(0, { [V1]: held(3 * GIGA), [LLAMACPP]: held(3 * GIGA) }),
      { endpoint: OLLAMA, needBytes: 2 * GIGA },
      world({ lastUsedAt: new Map([[V1, 1_000]]) }),
    )

    expect(plan).toMatchObject({ release: [LLAMACPP] })
  })

  // The NaN trap in its second disguise: the sentinel for "never used" is -Infinity, and
  // subtracting it from itself gives NaN, which orders two never-used endpoints at random. The
  // comparison has to answer 0 for them, and the plan has to stay deterministic.
  it('orders two endpoints that never served without going random', () => {
    const runtimeBytes = { [V1]: held(3 * GIGA), [LLAMACPP]: held(3 * GIGA) }
    const request = { endpoint: OLLAMA, needBytes: 2 * GIGA }

    const plans = Array.from({ length: 8 }, () =>
      admissionFor(snapshot(0, runtimeBytes), request, world()),
    )

    expect(new Set(plans.map(plan => JSON.stringify(plan))).size).toBe(1)
    expect(plans[0]).toMatchObject({ verdict: 'release-first' })
  })

  it('stops as soon as the plan covers the gap', () => {
    const plan = admissionFor(
      snapshot(0, { [V1]: held(9 * GIGA), [LLAMACPP]: held(9 * GIGA) }),
      { endpoint: OLLAMA, needBytes: 2 * GIGA },
      world({
        lastUsedAt: new Map([
          [V1, 1_000],
          [LLAMACPP, 2_000],
        ]),
      }),
    )

    expect(plan).toMatchObject({ release: [V1], expectedFreeBytes: 9 * GIGA })
  })

  // The door being loaded onto is a candidate like any other: unloading what it already holds is
  // how it makes room for the next model.
  it('may release the very door the job is asking for', () => {
    const plan = admissionFor(
      snapshot(0, { [OLLAMA]: held(5 * GIGA) }),
      { endpoint: OLLAMA, needBytes: 4 * GIGA },
      world(),
    )

    expect(plan).toMatchObject({ release: [OLLAMA] })
  })
})
