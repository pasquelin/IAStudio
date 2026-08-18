import { AnimationClip, Object3D, VectorKeyframeTrack } from 'three'
import { describe, expect, it } from 'vitest'
import { embeddedClip, type ClipRef } from '@shared/domain/scene'
import { SceneAnimations, clipNamesOf, playedClip } from './animation'

/** A cube travelling one unit along X over one second, which is enough to read a mixer by. */
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
}: Partial<ClipRef> & { name?: string } = {}) => embeddedClip(id, name, { playing: true, ...extra })

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

  it('moves the model the clip addresses', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', ref())
    animations.update(0.5)

    expect(cubeOf(root).position.x).toBeCloseTo(0.5, 5)
  })

  it('stays where it is while paused, however many frames go by', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', ref({ playing: false }))
    animations.update(0.5)
    animations.update(0.5)

    expect(cubeOf(root).position.x).toBe(0)
  })

  it('says whether anything moved, so the frame loop can go back to sleep', () => {
    const { animations } = withWalk()

    animations.apply('node-1', ref({ playing: false }))
    expect(animations.update(0.1)).toBe(false)

    animations.apply('node-1', ref())
    expect(animations.update(0.1)).toBe(true)
  })

  it('runs at the speed the document asks for', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', ref({ speed: 2 }))
    animations.update(0.25)

    expect(cubeOf(root).position.x).toBeCloseTo(0.5, 5)
  })

  it('seeks where the head is put, without playing to get there', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', ref({ playing: false, offset: 0.75 }))
    animations.update(0)

    expect(cubeOf(root).position.x).toBeCloseTo(0.75, 5)
  })

  it('starts the clip over when it loops', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', ref({ loop: true }))
    // A whole clip and a half: a looping one is a quarter of the way back down its travel.
    animations.update(1.25)

    expect(cubeOf(root).position.x).toBeCloseTo(0.25, 5)
  })

  it('holds the last pose when it does not loop, rather than snapping back to the first', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', ref({ loop: false }))
    animations.update(1.25)

    expect(cubeOf(root).position.x).toBeCloseTo(1, 5)
  })

  it('keeps the head where it was when only the speed changes, rather than restarting', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', ref())
    animations.update(0.4)
    animations.apply('node-1', ref({ speed: 2 }))

    // Read off the object rather than off a getter: what the head is worth is what it shows.
    expect(cubeOf(root).position.x).toBeCloseTo(0.4, 5)
  })

  it('switches clip without carrying the previous head over', () => {
    const animations = new SceneAnimations()
    const root = scene()
    animations.add('node-1', root, [walkClip('walk'), walkClip('run', 2)])

    animations.apply('node-1', ref())
    animations.update(0.5)
    animations.apply('node-1', ref({ name: 'run' }))

    // Back to the start of the new clip, which for `run` means the origin.
    expect(cubeOf(root).position.x).toBe(0)
  })

  it('ignores a clip name the file no longer holds, rather than throwing', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', ref({ name: 'moonwalk' }))
    animations.update(0.5)

    expect(cubeOf(root).position.x).toBe(0)
  })

  it('puts the model back to its rest pose when the reference is cleared', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', ref())
    animations.update(0.5)
    animations.apply('node-1', null)

    // Without an action driving them, three restores the values the file was loaded with — and
    // it has to reach the objects on the spot, since nothing will advance afterwards.
    expect(cubeOf(root).position.x).toBe(0)
  })

  it('drives nothing once a node is removed', () => {
    const { animations, root } = withWalk()
    animations.apply('node-1', ref())
    animations.remove('node-1')
    animations.update(0.5)

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

describe('which block a model plays', () => {
  it('answers the first, and nothing for a model that plays nothing', () => {
    expect(playedClip([ref({ id: 'walk' }), ref({ id: 'dance' })])?.id).toBe('walk')
    expect(playedClip([])).toBeNull()
  })
})
