import { AnimationClip, Bone, Object3D, VectorKeyframeTrack } from 'three'
import { describe, expect, it } from 'vitest'
import { embeddedClip, type ClipRef } from '@shared/domain/scene'
import { SECOND } from '@shared/domain/time'
import { animationTrack, timelineWith } from './animation-fixtures'
import { SceneAnimations, clipNamesOf } from './animation'

/** A cube travelling `to` units along X over one second, which is enough to read a mixer by. */
function walkClip(name = 'walk', to = 1): AnimationClip {
  const track = new VectorKeyframeTrack('cube.position', [0, 1], [0, 0, 0, to, 0, 0])
  return new AnimationClip(name, 1, [track])
}

function scene(): Object3D {
  const root = new Object3D()
  const cube = new Object3D()
  cube.name = 'cube'
  root.add(cube)
  return root
}

/** `name` picks which clip of the file the block plays, since that now lives inside its source. */
const ref = ({
  name = 'walk',
  id = 'block-1',
  ...extra
}: Partial<ClipRef> & { name?: string } = {}) => embeddedClip(id, name, extra)

describe('the clips a model brought', () => {
  it('reads the names off the loaded root', () => {
    const source = scene()
    source.animations = [walkClip('walk'), walkClip('run')]

    expect(clipNamesOf(source)).toEqual(['walk', 'run'])
  })

  it('answers an empty list for a model carrying no clip at all', () => {
    expect(clipNamesOf(scene())).toEqual([])
  })
})

describe('SceneAnimations', () => {
  const withWalk = (): { animations: SceneAnimations; root: Object3D } => {
    const animations = new SceneAnimations()
    const root = scene()
    animations.add('node-1', root, [walkClip()])
    return { animations, root }
  }

  const cubeOf = (root: Object3D): Object3D => {
    const cube = root.children[0]
    if (!cube) throw new Error('the fixture builds one child')
    return cube
  }

  it('registers nothing for a model with no clips, so nothing is driven', () => {
    const animations = new SceneAnimations()
    animations.add('node-1', scene(), [])

    expect(animations.has('node-1')).toBe(false)
  })

  it('places the model where the head says, without playing to get there', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', [ref()])
    animations.seek(0.75 * SECOND)

    expect(cubeOf(root).position.x).toBeCloseTo(0.75, 5)
  })

  it('runs at the speed the document asks for, which shortens the block', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', [ref({ speed: 2 })])
    animations.seek(0.25 * SECOND)

    expect(cubeOf(root).position.x).toBeCloseTo(0.5, 5)
  })

  it('wraps a looping block rather than running off its end', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', [ref({ loop: true, duration: 3 * SECOND })])
    animations.seek(1.25 * SECOND)

    expect(cubeOf(root).position.x).toBeCloseTo(0.25, 5)
  })

  it('holds the last pose of a block that does not loop, rather than snapping back', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', [ref({ loop: false })])
    animations.seek(5 * SECOND)

    expect(cubeOf(root).position.x).toBeCloseTo(1, 5)
  })

  it('ignores a clip name the file no longer holds, rather than throwing', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', [ref({ name: 'moonwalk' })])
    animations.seek(0.5 * SECOND)

    expect(cubeOf(root).position.x).toBe(0)
  })

  it('puts the model back to its rest pose when the last block is taken off', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', [ref()])
    animations.seek(0.5 * SECOND)
    animations.apply('node-1', [])

    // Without an action driving them, three restores the values the file was loaded with — and
    // it has to reach the objects on the spot, since nothing will advance afterwards.
    expect(cubeOf(root).position.x).toBe(0)
  })

  it('drives nothing once a node is removed', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', [ref()])
    animations.remove('node-1')
    animations.seek(0.5 * SECOND)

    expect(animations.has('node-1')).toBe(false)
    expect(cubeOf(root).position.x).toBe(0)
  })

  it('lets go of every node at once', () => {
    const animations = new SceneAnimations()
    animations.add('node-1', scene(), [walkClip()])
    animations.add('node-2', scene(), [walkClip()])
    animations.clear()

    expect(animations.has('node-1')).toBe(false)
    expect(animations.has('node-2')).toBe(false)
  })
})

describe('several blocks on one model', () => {
  const twoClips = (): { animations: SceneAnimations; root: Object3D; cube: Object3D } => {
    const animations = new SceneAnimations()
    const root = new Object3D()
    const cube = new Object3D()
    cube.name = 'cube'
    root.add(cube)
    animations.add('node-1', root, [walkClip('walk'), walkClip('run', 2)])
    return { animations, root, cube }
  }

  const walk = (extra: Partial<ClipRef> = {}): ClipRef => embeddedClip('walk', 'walk', extra)
  const run = (extra: Partial<ClipRef> = {}): ClipRef => embeddedClip('run', 'run', extra)

  it('plays the block the head is inside, and no other', () => {
    const { animations, cube } = twoClips()
    animations.apply('node-1', [walk(), run({ start: SECOND })])

    animations.seek(0.5 * SECOND)
    expect(cube.position.x).toBeCloseTo(0.5, 5)

    // Half a second into `run`, which travels twice as far in the same time.
    animations.seek(1.5 * SECOND)
    expect(cube.position.x).toBeCloseTo(1, 5)
  })

  it('shows a mix of both blocks halfway through a fade, rather than one then the other', () => {
    const { animations, cube } = twoClips()
    const spans = { duration: 2 * SECOND }

    animations.apply('node-1', [walk(spans)])
    animations.seek(1.5 * SECOND)
    const walkAlone = cube.position.x

    animations.apply('node-1', [run({ ...spans, start: SECOND })])
    animations.seek(1.5 * SECOND)
    const runAlone = cube.position.x

    animations.apply('node-1', [
      walk({ ...spans, fadeOut: SECOND }),
      run({ ...spans, start: SECOND, fadeIn: SECOND }),
    ])
    animations.seek(1.5 * SECOND)

    // Halfway through complementary fades the weights are a half each, so the pose is the
    // average of the two — which is what stops a jump between neighbouring blocks.
    expect(cube.position.x).toBeCloseTo((walkAlone + runAlone) / 2, 5)
  })

  it('answers the same pose for one head however the head got there', () => {
    const { animations, cube } = twoClips()
    animations.apply('node-1', [
      walk({ duration: 2 * SECOND, fadeOut: SECOND }),
      run({ start: SECOND, duration: 2 * SECOND, fadeIn: SECOND }),
    ])

    animations.seek(1.5 * SECOND)
    const forwards = cube.position.x
    animations.seek(2.4 * SECOND)
    animations.seek(0.2 * SECOND)
    animations.seek(1.5 * SECOND)

    expect(cube.position.x).toBe(forwards)
  })

  it('gives two blocks of the SAME clip two heads of their own', () => {
    const { animations, cube } = twoClips()
    animations.apply('node-1', [
      embeddedClip('first', 'walk'),
      embeddedClip('second', 'walk', { start: 4 * SECOND }),
    ])

    animations.seek(4.25 * SECOND)

    // The second block is a quarter of the way in; sharing one action would have shown the first
    // block's own head, four seconds past its end.
    expect(cube.position.x).toBeCloseTo(0.25, 5)
  })
})

describe('a block that carries its character across the floor', () => {
  const rigged = (): { animations: SceneAnimations; hip: Object3D } => {
    const animations = new SceneAnimations()
    const root = new Object3D()
    const hip = new Bone()
    hip.name = 'Hip'
    const spine = new Bone()
    spine.name = 'Spine'
    hip.add(spine)
    root.add(hip)

    const clip = new AnimationClip('walk', 1, [
      new VectorKeyframeTrack('Hip.position', [0, 1], [0, 0, 0, 4, 0, 0]),
      new VectorKeyframeTrack('Spine.position', [0, 1], [0, 0, 0, 0, 1, 0]),
    ])
    animations.add('node-1', root, [clip])
    return { animations, hip }
  }

  const trajectory = () =>
    timelineWith([
      animationTrack(
        'move',
        'position',
        [
          { time: 0, value: { x: 0, y: 0, z: 0 } },
          { time: SECOND, value: { x: 4, y: 0, z: 0 } },
        ],
        { target: { nodeId: 'node-1', property: 'position' } },
      ),
    ])

  it('travels on its own when the band drives the node nowhere', () => {
    const { animations, hip } = rigged()
    animations.apply('node-1', [embeddedClip('block-1', 'walk', { rootMotion: 'auto' })])
    animations.seek(0.5 * SECOND)

    expect(hip.position.x).toBeCloseTo(2, 5)
  })

  it('walks on the spot as soon as the band carries the node, so nothing moves twice', () => {
    const { animations, hip } = rigged()
    animations.setTimeline(trajectory())
    animations.apply('node-1', [embeddedClip('block-1', 'walk', { rootMotion: 'auto' })])
    animations.seek(SECOND)

    expect(hip.position.x).toBe(0)
  })

  it('keeps everything the travel is not, so a neutralised walk still walks', () => {
    const { animations, hip } = rigged()
    animations.setTimeline(trajectory())
    animations.apply('node-1', [embeddedClip('block-1', 'walk', { rootMotion: 'auto' })])
    animations.seek(0.5 * SECOND)

    const spine = hip.children[0]
    expect(spine?.position.y).toBeCloseTo(0.5, 5)
  })

  it('stops travelling the moment a trajectory is keyed under it', () => {
    const { animations, hip } = rigged()
    animations.apply('node-1', [embeddedClip('block-1', 'walk', { rootMotion: 'auto' })])
    animations.seek(0.5 * SECOND)
    expect(hip.position.x).toBeCloseTo(2, 5)

    animations.setTimeline(trajectory())

    // No node of the document changed, so nothing else would have told this block to give up
    // its own travel.
    expect(hip.position.x).toBe(0)
  })

  it('travels anyway when the document says so plainly', () => {
    const { animations, hip } = rigged()
    animations.setTimeline(trajectory())
    animations.apply('node-1', [embeddedClip('block-1', 'walk', { rootMotion: 'travel' })])
    animations.seek(0.5 * SECOND)

    expect(hip.position.x).toBeCloseTo(2, 5)
  })
})
