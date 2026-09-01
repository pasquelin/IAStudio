// SPDX-License-Identifier: MIT

import type { AudioPort } from '../ports/audioPort'

/**
 * Installed by BOTH hosts while there is no mixer: `play` answers nothing, which is what the
 * contract already reserves for a host that cannot start a sound.
 */
export function createInertAudio(): AudioPort {
  return { play: () => null, stopAll: () => {} }
}
