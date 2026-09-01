import { DirectionalLight, type Scene } from 'three'
import { directionFromAngles } from '@shared/domain/angles'
import type { SunSettings } from '@shared/domain/skybox'

export type SkySun = {
  /** Where the sky puts its sun, or `null` for a scene lit by no sky. Safe on every apply. */
  apply: (sun: SunSettings | null) => void
  dispose: () => void
}

/**
 * Far enough that the shadow camera the scene may hang on it covers the ground, close enough that
 * its position stays a readable number.
 */
const DISTANCE = 50

/**
 * The sun a SKY describes, as a light of the scene. It belongs to no node and is saved by no
 * document: a node would be a copy, and would come back after the sky stopped describing one.
 */
export function createSkySun(scene: Scene): SkySun {
  const light = new DirectionalLight(0xffffff, 0)
  light.visible = false
  scene.add(light)
  /** The hex as the document spells it: `Color.set` runs a regex, and a sun drag moves angles only. */
  let painted: string | null = null

  return {
    apply: sun => {
      light.visible = sun !== null
      if (!sun) return

      const { x, y, z } = directionFromAngles(sun)
      light.position.set(x * DISTANCE, y * DISTANCE, z * DISTANCE)
      light.intensity = sun.intensity
      if (sun.color !== painted) {
        painted = sun.color
        light.color.set(sun.color)
      }
    },
    dispose: () => {
      scene.remove(light)
      light.dispose()
    },
  }
}
