import type { Layer } from './canvas-state'

/**
 * A layer for tests. Declared once so a new required field on `Layer` breaks in one place rather
 * than in every suite that builds one by hand. It defaults to the second layer of a stack, which
 * is what a test needs when it wants one more than the canvas opens with.
 */
export function layerFixture(overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'layer-2',
    name: 'Paint',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    ...overrides,
  }
}
