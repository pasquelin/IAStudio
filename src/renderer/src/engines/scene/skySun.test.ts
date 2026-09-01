import { DirectionalLight, Scene } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SUN } from '@shared/domain/skybox'
import { createSkySun } from './skySun'

const lightIn = (scene: Scene): DirectionalLight | undefined =>
  scene.children.find(child => child instanceof DirectionalLight)

describe('the sun a sky describes, as a light of the scene', () => {
  it('hangs a light in the scene, dark until a sky describes one', () => {
    const scene = new Scene()

    createSkySun(scene)

    expect(lightIn(scene)?.visible).toBe(false)
  })

  it('points the light where the sky puts its sun, in its colour and its strength', () => {
    const scene = new Scene()
    const sun = createSkySun(scene)

    sun.apply({ elevation: Math.PI / 2, azimuth: 0, intensity: 3, color: '#ff0000' })

    const light = lightIn(scene)
    expect(light?.visible).toBe(true)
    // Straight up: the light stands along its direction, and three reads the vector to the origin.
    expect(light?.position.y).toBeCloseTo(50)
    expect(light?.position.x).toBeCloseTo(0)
    expect(light?.intensity).toBe(3)
    expect(light?.color.getHex()).toBe(0xff0000)
  })

  /**
   * Hidden and not removed: three recompiles every material of the scene when the NUMBER of
   * lights changes, and a slider dragged in the sky's own tab would pay for that on every value.
   */
  it('puts the sun out without taking the light out of the scene', () => {
    const scene = new Scene()
    const sun = createSkySun(scene)
    sun.apply(DEFAULT_SUN)
    const count = scene.children.length

    sun.apply(null)

    expect(lightIn(scene)?.visible).toBe(false)
    expect(scene.children).toHaveLength(count)
  })

  it('takes its light back out of the scene when the viewport goes', () => {
    const scene = new Scene()
    const sun = createSkySun(scene)

    sun.dispose()

    expect(lightIn(scene)).toBeUndefined()
  })
})
