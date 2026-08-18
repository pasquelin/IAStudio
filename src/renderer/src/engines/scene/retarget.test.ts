import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'
import { describe, expect, it } from 'vitest'
import {
  clipFromWire,
  createRetarget,
  nodeTrackNameOf,
  retargetPlanOf,
  sameSkeleton,
  skinnedFromWire,
  wireBonesOf,
  wireClipOf,
} from './retarget'
import type { RetargetIncoming, RetargetResponse, WireBone } from './retargetMessage'

function boneAt(name: string, parent: number, y: number, scale = 1): WireBone {
  return {
    name,
    parent,
    position: [0, y, 0],
    quaternion: [0, 0, 0, 1],
    scale: [scale, scale, scale],
  }
}

/**
 * Mixamo's spelling AS THREE HOLDS IT: `GLTFLoader` runs every node name through
 * `PropertyBinding.sanitizeNodeName`, which DELETES `:` rather than replacing it. A bone still
 * named `mixamorig:Hips` binds to nothing — measured on the real file on 2026-08-18.
 */
const UTHANA: WireBone[] = [
  boneAt('mixamorigHips', -1, 1),
  boneAt('mixamorigSpine', 0, 0.2),
  boneAt('mixamorigHead', 1, 0.4),
  boneAt('mixamorigLeftArm', 1, 0.3),
]

/** Tripo's, on a character twice as tall. */
const TRIPO: WireBone[] = [
  boneAt('Hip', -1, 2),
  boneAt('Waist', 0, 0.4),
  boneAt('Head', 1, 0.8),
  boneAt('L_Upperarm', 1, 0.6),
  boneAt('L_UpperarmTwist01', 3, 0.1),
]

/**
 * A worker the test answers by hand, so what is under test is the register rather than three's
 * sampling — `skinWeights.test.ts` builds its fake the same way, and the cast is the same one:
 * the port calls exactly these members, and jsdom has no `Worker` at all.
 */
function scriptedWorker() {
  const listeners = new Map<string, ((event: unknown) => void)[]>()
  const sent: RetargetIncoming[] = []
  let spawned = 0

  const worker = {
    postMessage: (message: RetargetIncoming) => void sent.push(message),
    terminate: () => {},
    addEventListener: (kind: string, listener: (event: unknown) => void) =>
      void listeners.set(kind, [...(listeners.get(kind) ?? []), listener]),
  }

  return {
    spawn: () => {
      spawned += 1
      return worker as unknown as Worker
    },
    sent,
    get spawned() {
      return spawned
    },
    answer: (response: RetargetResponse) => {
      for (const listener of listeners.get('message') ?? []) listener({ data: response })
    },
  }
}

function turnClip(boneName: string): AnimationClip {
  return new AnimationClip('walk', 1, [
    new QuaternionKeyframeTrack(`${boneName}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0.7, 0, 0.7]),
  ])
}

describe('pairing two skeletons', () => {
  it('spells the map from target bone to source bone, which is the direction three reads', () => {
    const plan = retargetPlanOf(TRIPO, UTHANA, [])

    expect(plan.names.Hip).toBe('mixamorigHips')
    expect(plan.names.Waist).toBe('mixamorigSpine')
    expect(plan.names.L_Upperarm).toBe('mixamorigLeftArm')
  })

  it('leaves a target bone filling no role out of the map, so it rests', () => {
    expect(retargetPlanOf(TRIPO, UTHANA, []).names.L_UpperarmTwist01).toBeUndefined()
  })

  it('names the hips under their source spelling, which is what three compares', () => {
    expect(retargetPlanOf(TRIPO, UTHANA, []).hip).toBe('mixamorigHips')
  })

  it('pairs bones that already share a name, even where no role was read', () => {
    const odd: WireBone[] = [boneAt('Hip', -1, 2), boneAt('Antenna', 0, 0.5)]
    const other: WireBone[] = [boneAt('Hips', -1, 1), boneAt('Antenna', 0, 0.3)]

    expect(retargetPlanOf(odd, other, []).names.Antenna).toBe('Antenna')
  })
})

describe('deciding whether to retarget at all', () => {
  it('calls two skeletons the same when names, tree and rest pose all agree', () => {
    expect(sameSkeleton(UTHANA, [...UTHANA])).toBe(true)
  })

  it('tells apart two skeletons spelled alike but built to other proportions', () => {
    const taller = UTHANA.map(bone => boneAt(bone.name, bone.parent, bone.position[1] * 2))

    // The names match exactly; playing one's rotations on the other is the very case retargeting
    // exists for, so this must not short-circuit.
    expect(sameSkeleton(UTHANA, taller)).toBe(false)
  })

  it('tells apart two skeletons of the same bones hung differently', () => {
    const flat = UTHANA.map(bone =>
      boneAt(bone.name, bone.parent === 1 ? 0 : bone.parent, bone.position[1]),
    )

    expect(sameSkeleton(UTHANA, flat)).toBe(false)
  })
})

describe('asking the worker', () => {
  it('answers an identical skeleton without starting a worker at all', async () => {
    const script = scriptedWorker()
    const clips = [turnClip('mixamorigSpine')]
    const model = skinnedFromWire(UTHANA)

    const adapted = await createRetarget(script.spawn).adapt(model, skinnedFromWire(UTHANA), clips)

    expect(adapted).toEqual(clips)
    expect(script.spawned).toBe(0)
  })

  it('sends the two skeletons and the clips, and answers what comes back', async () => {
    const script = scriptedWorker()
    const port = createRetarget(script.spawn)

    const pending = port.adapt(skinnedFromWire(TRIPO), skinnedFromWire(UTHANA), [
      turnClip('mixamorigSpine'),
    ])
    const request = script.sent[0]
    if (!request || 'cancel' in request) throw new Error('nothing was asked of the worker')

    expect(request.names.Waist).toBe('mixamorigSpine')
    script.answer({ id: request.id, done: true, ok: true, clips: [wireClipOf(turnClip('Waist'))] })

    expect((await pending)?.[0]?.tracks[0]?.name).toBe('Waist.quaternion')
  })

  it('reports each clip as it lands', async () => {
    const script = scriptedWorker()
    const seen: number[] = []
    const port = createRetarget(script.spawn)

    const pending = port.adapt(skinnedFromWire(TRIPO), skinnedFromWire(UTHANA), [turnClip('x')], {
      onProgress: progress => void seen.push(progress),
    })
    const request = script.sent[0]
    if (!request || 'cancel' in request) throw new Error('nothing was asked of the worker')

    script.answer({ id: request.id, done: false, progress: 0.5 })
    script.answer({ id: request.id, done: true, ok: true, clips: [] })
    await pending

    expect(seen).toEqual([0.5])
  })

  it('lets a caller take a request back, and tells the worker to stop', async () => {
    const script = scriptedWorker()
    const stop = new AbortController()
    const port = createRetarget(script.spawn)

    const pending = port.adapt(skinnedFromWire(TRIPO), skinnedFromWire(UTHANA), [turnClip('x')], {
      signal: stop.signal,
    })
    stop.abort()

    expect(await pending).toBeNull()
    expect(script.sent.at(-1)).toEqual({ id: 1, cancel: true })
  })

  it('answers nothing once the port has let go, rather than waiting forever', async () => {
    const script = scriptedWorker()
    const port = createRetarget(script.spawn)
    port.dispose()

    expect(await port.adapt(skinnedFromWire(TRIPO), skinnedFromWire(UTHANA), [])).toBeNull()
  })
})

describe('crossing the wire', () => {
  it('reads a skeleton off a model, parents before children', () => {
    const bones = wireBonesOf(skinnedFromWire(TRIPO))

    expect(bones.map(bone => bone.name)).toEqual(TRIPO.map(bone => bone.name))
    expect(bones.every((bone, index) => bone.parent < index)).toBe(true)
  })

  it('carries a clip out and back unchanged', () => {
    const clip = new AnimationClip('walk', 2, [
      new QuaternionKeyframeTrack('Hips.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
      new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0]),
    ])
    const back = clipFromWire(wireClipOf(clip))

    expect(back.name).toBe('walk')
    expect(back.tracks.map(track => track.ValueTypeName)).toEqual(['quaternion', 'vector'])
    expect([...(back.tracks[1]?.values ?? [])]).toEqual([0, 0, 0, 0, 1, 0])
  })

  it('reads three’s skeleton spelling as the node spelling every glTF clip uses', () => {
    expect(nodeTrackNameOf('.bones[mixamorigHips].quaternion')).toBe('mixamorigHips.quaternion')
    expect(nodeTrackNameOf('Hips.position')).toBe('Hips.position')
  })
})
