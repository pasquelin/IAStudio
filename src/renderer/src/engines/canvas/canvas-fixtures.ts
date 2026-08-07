import { pixelLayer, type PixelLayer } from './canvas-state'

/**
 * A layer for tests. Declared once so a new required field on `Layer` breaks in one place rather
 * than in every suite that builds one by hand. It defaults to the second layer of a stack, which
 * is what a test needs when it wants one more than the canvas opens with.
 *
 * Built through `pixelLayer` rather than as a literal: a fixture that spelled the defaults out
 * would be the one layer in the codebase the compositor treats differently.
 */
export function layerFixture(overrides: Partial<PixelLayer> = {}): PixelLayer {
  return { ...pixelLayer('layer-2', 'Paint'), ...overrides }
}
