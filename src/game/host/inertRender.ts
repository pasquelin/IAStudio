// SPDX-License-Identifier: MIT

import type { RenderPort } from '../ports/renderPort'

/**
 * Installed by BOTH hosts: what draws a game is the world holding the entities, and there is
 * none yet. Named rather than hidden — a port quietly doing half the job would be worse.
 */
export function createInertRender(): RenderPort {
  return { place: () => {}, view: () => {}, veil: () => {} }
}
