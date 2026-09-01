import type { PerspectiveCamera, Scene, Texture } from 'three'

export const GROUPS: readonly number[]
export const MOVING_SHARE: number
export function checker(size?: number): Texture
export const place: (index: number, total: number) => { x: number; y: number; z: number }
export function build(floor: number): {
  scene: Scene
  camera: PerspectiveCamera
  update: (frame: number) => void
  total: number
  movers: number
}
