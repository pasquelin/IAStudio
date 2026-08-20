import { describe, expect, it } from 'vitest'
import { SCENE_TEMPLATE_IDS } from '@shared/domain/sceneTemplate'
import { rememberCheckerTextures, forgetCheckerTextures } from './checkerTextures'
import { pitchTowards, sceneFromTemplate } from './sceneTemplates'
import type { SceneNode } from './sceneState'

const typesIn = (nodes: readonly SceneNode[]): string[] => nodes.map(node => node.type)

describe('sceneFromTemplate', () => {
  it('opens every template on a lit scene, so none of them looks like a broken viewport', () => {
    for (const id of SCENE_TEMPLATE_IDS) {
      expect(typesIn(sceneFromTemplate(id).nodes)).toContain('light')
    }
  })

  it('holds no mesh in the empty one: nothing has been modelled yet', () => {
    expect(sceneFromTemplate('empty').nodes.filter(node => node.type === 'mesh')).toEqual([])
  })

  it('gives the basic one a floor, a camera and no selection', () => {
    const scene = sceneFromTemplate('basic')

    expect(typesIn(scene.nodes)).toEqual(['mesh', 'light', 'light', 'camera'])
    expect(scene.selectedIds).toEqual([])
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
    for (const id of ['thirdPerson', 'topDown'] as const) {
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

    expect(camera?.transform.position).toEqual({ x: 0, y: 1.7, z: 0 })
    expect(camera?.transform.rotation).toEqual({ x: 0, y: 0, z: 0 })
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

    rememberCheckerTextures([{ id: 'checkerLarge', assetId: 'asset_checker' }])
    const dressed = sceneFromTemplate('basic').nodes.find(node => node.type === 'mesh')
    expect(dressed?.type === 'mesh' && dressed.material.map).toEqual({ assetId: 'asset_checker' })

    forgetCheckerTextures()
  })

  it('leaves the photo studio backdrop unpainted by the checker', () => {
    rememberCheckerTextures([{ id: 'checkerLarge', assetId: 'asset_checker' }])
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
