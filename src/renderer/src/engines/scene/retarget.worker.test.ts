import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'
import type * as SkeletonUtilsModule from 'three/addons/utils/SkeletonUtils.js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { wireClipOf } from './retarget'
import type { RetargetResponse, WireBone, WireClip } from './retargetMessage'

/** three's sampling, made to fail on demand: what is under test is what the worker does then. */
const sampling = vi.hoisted(() => ({ fails: false }))

vi.mock('three/addons/utils/SkeletonUtils.js', async importOriginal => {
  const real = await importOriginal<typeof SkeletonUtilsModule>()
  return {
    ...real,
    retargetClip: (...args: Parameters<typeof real.retargetClip>) => {
      if (sampling.fails) throw new Error('out of memory')
      return real.retargetClip(...args)
    },
  }
})

const posted: RetargetResponse[] = []

// Imported once for the file: the module registers its listener on import, and a second import
// would leave two of them answering every request.
beforeAll(async () => {
  vi.spyOn(self, 'postMessage').mockImplementation((message: unknown) => {
    posted.push(message as RetargetResponse)
  })
  await import('./retarget.worker')
})

beforeEach(() => {
  sampling.fails = false
  posted.length = 0
})

function boneAt(name: string, parent: number, y: number): WireBone {
  return { name, parent, position: [0, y, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] }
}

/** Mixamo's spelling. */
const SOURCE: WireBone[] = [
  boneAt('mixamorigHips', -1, 1),
  boneAt('mixamorigSpine', 0, 0.2),
  boneAt('mixamorigHead', 1, 0.4),
]

/** Tripo's, on a character twice as tall — the case a bone map alone cannot handle. */
const TARGET: WireBone[] = [boneAt('Hip', -1, 2), boneAt('Waist', 0, 0.4), boneAt('Head', 1, 0.8)]

/** A quarter turn of the spine over one second. */
function spineTurn(): WireClip {
  return wireClipOf(
    new AnimationClip('walk', 1, [
      new QuaternionKeyframeTrack(
        'mixamorigSpine.quaternion',
        [0, 1],
        [0, 0, 0, 1, 0, 0.383, 0, 0.924],
      ),
    ]),
  )
}

/** `null` asks for no rate at all — passing `undefined` would fall back on the default below. */
function ask(id: number, clips: readonly WireClip[], fps: number | null = 30): void {
  self.dispatchEvent(
    new MessageEvent('message', {
      data: {
        id,
        target: TARGET,
        source: SOURCE,
        clips,
        names: { Hip: 'mixamorigHips', Waist: 'mixamorigSpine', Head: 'mixamorigHead' },
        hip: 'mixamorigHips',
        fps: fps ?? undefined,
      },
    }),
  )
}

/** The source walks one unit forward on hips that start at the origin. */
function hipTravel(): WireClip {
  return wireClipOf(
    new AnimationClip('walk', 1, [
      new VectorKeyframeTrack('mixamorigHips.position', [0, 1], [0, 1, 0, 1, 1, 0]),
    ]),
  )
}

/** `frames` keys spread over one second, so the clip's own rate is `frames` per second. */
function spineTurnAt(frames: number): WireClip {
  const times = Array.from({ length: frames }, (_, frame) => frame / (frames - 1))
  const values = times.flatMap((_, frame) => [0, frame / (frames - 1), 0, 1])

  return wireClipOf(
    new AnimationClip('walk', 1, [
      new QuaternionKeyframeTrack('mixamorigSpine.quaternion', times, values),
    ]),
  )
}

function settled(): RetargetResponse | undefined {
  return posted.find(response => response.done)
}

async function drain(): Promise<void> {
  // The worker comes back for air between clips; two turns of the timer queue clear a short run.
  for (let turn = 0; turn < 8; turn += 1) await new Promise(resolve => setTimeout(resolve, 0))
}

describe('replaying an animation on another skeleton', () => {
  it('answers tracks named for the target bones, in the node spelling glTF uses', async () => {
    ask(1, [spineTurn()])
    await drain()

    const answer = settled()
    if (!answer?.done || !answer.ok) throw new Error('the worker did not answer with clips')
    const names = answer.clips[0]?.tracks.map(track => track.name) ?? []

    expect(names).toContain('Waist.quaternion')
    // `.bones[Waist].quaternion` is what three writes, and it binds against nothing this studio
    // plays a clip on.
    expect(names.every(name => !name.startsWith('.bones['))).toBe(true)
  })

  it('carries the turn over to the bone that fills the same role', async () => {
    ask(1, [spineTurn()])
    await drain()

    const answer = settled()
    if (!answer?.done || !answer.ok) throw new Error('the worker did not answer with clips')
    const turned = answer.clips[0]?.tracks.find(track => track.name === 'Waist.quaternion')
    const last = turned?.values.slice(-4) ?? new Float32Array()

    // A quarter turn about Y, sampled: the identity quaternion would be [0, 0, 0, 1].
    expect(Math.abs(last[1] ?? 0)).toBeGreaterThan(0.3)
  })

  it('reads the hips’ travel at the target’s size, so its feet do not slide', async () => {
    ask(1, [hipTravel()])
    await drain()

    const answer = settled()
    if (!answer?.done || !answer.ok) throw new Error('the worker did not answer with clips')
    const travel = answer.clips[0]?.tracks.find(track => track.name === 'Hip.position')
    if (!travel) throw new Error('the hips carried no translation at all')

    // The source walks one unit forward on a torso of 0.4; the target's is 0.8, so it must cover
    // two. Carried over unchanged — three's default `scale` of 1 — it would cover one and slide.
    expect(Math.abs(travel.values[travel.values.length - 3] ?? 0)).toBeGreaterThan(1.5)
  })

  it('keeps the length the source was authored at', async () => {
    ask(1, [spineTurn()])
    await drain()

    const answer = settled()
    if (!answer?.done || !answer.ok) throw new Error('the worker did not answer with clips')

    expect(answer.clips[0]?.duration).toBe(1)
  })

  it('samples at the source clip’s own rate when none is asked for', async () => {
    // The two measured providers disagree — Tripo authored at 24, Uthana at 30 — so a fixed rate
    // would resample one of them for nothing.
    ask(1, [spineTurnAt(12)], null)
    await drain()

    const answer = settled()
    if (!answer?.done || !answer.ok) throw new Error('the worker did not answer with clips')

    expect(answer.clips[0]?.tracks[0]?.times).toHaveLength(12)
  })

  it('reports one step per clip', async () => {
    ask(1, [spineTurn(), spineTurn()])
    await drain()

    expect(posted.filter(response => !response.done)).toEqual([
      { id: 1, done: false, progress: 0.5 },
      { id: 1, done: false, progress: 1 },
    ])
  })
})

describe('when a run goes wrong or is taken back', () => {
  it('reports a failure rather than dying silently', async () => {
    sampling.fails = true
    ask(1, [spineTurn()])
    await drain()

    expect(settled()).toEqual({ id: 1, done: true, ok: false, error: 'out of memory' })
  })

  it('says nothing more about a request taken back mid-run', async () => {
    ask(1, [spineTurn(), spineTurn(), spineTurn()])
    self.dispatchEvent(new MessageEvent('message', { data: { id: 1, cancel: true } }))
    await drain()

    expect(settled()).toBeUndefined()
  })

  /**
   * A cancellation crossing paths with the answer it meant to stop is the ordinary case, not an
   * edge: the caller drops its slot and posts one anyway. Remembered, that id would silence the
   * next request wearing it — and would sit in the worker's memory for the life of the window.
   */
  it('forgets a cancellation that arrived after the run it named had ended', async () => {
    ask(1, [spineTurn()])
    await drain()
    self.dispatchEvent(new MessageEvent('message', { data: { id: 1, cancel: true } }))
    posted.length = 0

    ask(1, [spineTurn()])
    await drain()

    expect(settled()).toBeDefined()
  })
})
