// SPDX-License-Identifier: MIT

import type { UiRenderPort } from '../ports/uiRenderPort'

/**
 * For a host with nowhere to draw an interface — a headless run, a suite stepping a world.
 *
 * Named rather than hidden, like the six inert ports beside it: `pick` answers NOTHING rather
 * than guessing, so a caller reading a hit off a surface that does not exist gets the honest
 * answer instead of an element it could not have touched.
 */
export function createInertUiRender(): UiRenderPort {
  return { draw: () => {}, pick: () => null, resize: () => {}, dispose: () => {} }
}
