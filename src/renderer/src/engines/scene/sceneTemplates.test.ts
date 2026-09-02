import { describe, expect, it } from 'vitest'
import { DEFAULT_CHECKER_TEXTURE } from '@shared/domain/checkerTexture'
import { SCENE_SUBJECT_ID } from '@shared/domain/animation'
import { SCENE_TEMPLATE_IDS, type SceneTemplateId } from '@shared/domain/sceneTemplate'
import { rememberCheckerTextures, forgetCheckerTextures } from './checkerTextures'
import { pitchTowards, sceneFromTemplate } from './sceneTemplates'
import type { SceneNode } from './sceneState'

const typesIn = (nodes: readonly SceneNode[]): string[] => nodes.map(node => node.type)

describe('sceneFromTemplate', () => {
  /**
   * 🛑 What a machine points at, held against what the template actually carries. A name nobody
   * wears is a beacon that never turns and a drone that never follows — in silence, since the
   * systems answer nothing for a name they cannot resolve. Renaming the stand-in is what this
   * catches, and only a template can: the level names `Character`, which the level does not hold.
   */
  it('points every component at a name its own template carries', () => {
    for (const id of SCENE_TEMPLATE_IDS) {
      const nodes = sceneFromTemplate(id).nodes
      const names = new Set(nodes.map(node => node.name))
      const wanted = nodes.flatMap(node =>
        (node.components ?? []).flatMap(component =>
          typeof component.target === 'string' && component.target !== '' ? [component.target] : [],
        ),
      )

      expect({ id, missing: wanted.filter(name => !names.has(name)) }).toEqual({ id, missing: [] })
    }
  })

  it('opens every template on a lit scene, so none of them looks like a broken viewport', () => {
    for (const id of SCENE_TEMPLATE_IDS) {
      expect(typesIn(sceneFromTemplate(id).nodes)).toContain('light')
    }
  })

  it('holds no mesh in the empty one: nothing has been modelled yet', () => {
    expect(sceneFromTemplate('empty').nodes.filter(node => node.type === 'mesh')).toEqual([])
  })

  it('gives the basic one a floor, a cube to scale it by, a camera and no selection', () => {
    const scene = sceneFromTemplate('basic')

    expect(typesIn(scene.nodes)).toEqual(['mesh', 'mesh', 'light', 'light', 'camera'])
    expect(scene.selectedIds).toEqual([])
  })

  // What sent the first batch back: one stretch of the checker over twenty metres reads as a blur.
  it('tiles a floor by the metre rather than stretching one picture over it', () => {
    const floor = sceneFromTemplate('basic').nodes.find(node => node.type === 'mesh')

    expect(floor?.type === 'mesh' && floor.material.tilesPerMetre).toBe(1)
  })

  it('lays the floor flat and keeps it out of the shadow pass', () => {
    const floor = sceneFromTemplate('basic').nodes.find(node => node.type === 'mesh')

    expect(floor?.transform.rotation).toEqual({ x: -Math.PI / 2, y: 0, z: 0 })
    expect(floor?.castShadow).toBe(false)
    expect(floor?.receiveShadow).toBe(true)
  })

  it('puts the cinematic camera on a rail, which is what the template is for', () => {
    expect(typesIn(sceneFromTemplate('cinematic').nodes)).toContain('path')
  })

  it('stands a person-sized stand-in in the two templates that frame one', () => {
    const framed: SceneTemplateId[] = ['thirdPerson', 'topDown']
    for (const id of framed) {
      const capsule = sceneFromTemplate(id).nodes.find(
        node => node.type === 'mesh' && node.geometry.kind === 'capsule',
      )
      expect(capsule?.transform.position.y).toBeCloseTo(0.9)
    }
  })

  it('gives the character templates feet on the ground, which nothing reads yet', () => {
    expect(sceneFromTemplate('firstPerson').world.play).toEqual({
      camera: 'firstPerson',
      eyeHeight: 1.7,
      moveSpeed: 4,
      gravity: 9.81,
    })
  })

  it('leaves the studio default in place for a template that says nothing about playing', () => {
    expect(sceneFromTemplate('basic').world.play.camera).toBe('orbit')
    expect(sceneFromTemplate('basic').world.play.gravity).toBe(0)
  })

  it('aims the first-person camera at the horizon, at eye height', () => {
    const camera = sceneFromTemplate('firstPerson').nodes.find(node => node.type === 'camera')

    expect(camera?.transform.position.y).toBe(1.7)
    expect(camera?.transform.rotation).toEqual({ x: 0, y: 0, z: 0 })
  })

  // Three cadrages over an empty floor proved nothing: what makes them worth picking is a set
  // one can climb, fall off and bump into — the same one for the three.
  it('opens the three character views on the same level, moving only the camera', () => {
    const shapesOf = (id: SceneTemplateId): string =>
      sceneFromTemplate(id)
        .nodes.filter(node => node.type === 'mesh')
        .map(node => (node.type === 'mesh' ? node.geometry.kind : ''))
        .join()

    expect(shapesOf('topDown')).toBe(shapesOf('thirdPerson'))
    expect(shapesOf('firstPerson').split(',').length).toBeGreaterThan(15)
  })

  it('builds a fresh scene each time, sharing no id with the last', () => {
    const first = sceneFromTemplate('basic').nodes.map(node => node.id)
    const second = sceneFromTemplate('basic').nodes.map(node => node.id)

    expect(new Set([...first, ...second]).size).toBe(first.length + second.length)
  })

  it('wears the project checker once it is installed, and plain paint until then', () => {
    forgetCheckerTextures()
    const bare = sceneFromTemplate('basic').nodes.find(node => node.type === 'mesh')
    expect(bare?.type === 'mesh' && bare.material.map).toBeNull()

    rememberCheckerTextures([{ id: DEFAULT_CHECKER_TEXTURE, assetId: 'asset_checker' }])
    const dressed = sceneFromTemplate('basic').nodes.find(node => node.type === 'mesh')
    expect(dressed?.type === 'mesh' && dressed.material.map).toEqual({ assetId: 'asset_checker' })

    forgetCheckerTextures()
  })

  it('leaves the photo studio backdrop unpainted by the checker', () => {
    rememberCheckerTextures([{ id: DEFAULT_CHECKER_TEXTURE, assetId: 'asset_checker' }])
    const backdrop = sceneFromTemplate('photoStudio').nodes.find(
      node => node.type === 'mesh' && node.transform.position.z === -5,
    )

    expect(backdrop?.type === 'mesh' && backdrop.material.map).toBeNull()
    forgetCheckerTextures()
  })
})

describe('pitchTowards', () => {
  it('tips a raised camera downward, and leaves one at target height level', () => {
    expect(pitchTowards(12, 8)).toBeLessThan(0)
    expect(pitchTowards(1.7, 6, 1.7)).toBe(0)
  })
})

describe('the template the composition is judged on', () => {
  const demo = sceneFromTemplate('postProcessing')

  /** § 28, as one gesture: open it, press Play, and the whole chain is in front of you. */
  it('opens with a composition already on the scene', () => {
    expect(demo.world.post.effects.map(one => one.effect)).toEqual([
      'gtao',
      'dof',
      'bloom',
      'colorGrading',
      'vignette',
      'smaa',
    ])
  })

  it('puts the camera on a rail for the length of the shot', () => {
    const shot = demo.animation.shots[0]
    const rail = demo.nodes.find(one => one.type === 'path')

    expect(shot?.motion?.pathId).toBe(rail?.id)
    expect(shot?.duration).toBe(demo.animation.duration)
  })

  /** The rack focus of § 14: sharp at fifteen metres, sharp at two three seconds later. */
  it('racks the focus from fifteen metres to two', () => {
    const focus = demo.animation.tracks.find(one => one.target.post?.param === 'focusDistance')
    const stack = demo.world.post.effects.find(one => one.effect === 'dof')

    expect(stack?.params.focusDistance).toBe(15)
    expect(focus?.keys.map(key => key.value.x)).toEqual([0, -13])
  })

  it('keys the flash and the exposure of § 15 on the scene, not on a camera', () => {
    const driven = demo.animation.tracks.filter(one => one.target.nodeId === SCENE_SUBJECT_ID)

    expect(driven).toHaveLength(3)
  })

  /** A band that shows no line for what it drives is a state no saved file can be in. */
  it('puts everything it animates on the sheet', () => {
    expect(demo.animation.sheet).toContain(SCENE_SUBJECT_ID)
    expect(demo.animation.sheet).toContain(demo.animation.shots[0]?.cameraId)
  })
})

/**
 * 🛑 An arm is a COMPONENT, so no menu of node types can offer one — a template that ships without
 * it is a feature nobody can reach without knowing where to look. Both names are checked because
 * an arm naming nothing is an arm that does nothing, in silence.
 */
describe('the arm the playable templates hang their camera on', () => {
  const wired: readonly { template: SceneTemplateId; subject: string }[] = [
    { template: 'thirdPerson', subject: 'Character' },
    { template: 'car', subject: 'Car' },
  ]

  for (const { template, subject } of wired) {
    it(`wires ${template} to a subject and a camera the scene really holds`, () => {
      const { nodes } = sceneFromTemplate(template)
      const arm = nodes.flatMap(node => node.components ?? []).find(one => one.type === 'SpringArm')
      const named = nodes.map(node => node.name)

      expect(arm?.subject).toBe(subject)
      expect(named).toContain(arm?.camera)
      expect(named).toContain(subject)
    })
  }
})
