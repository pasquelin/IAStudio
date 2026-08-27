// SPDX-License-Identifier: MIT

import { NO_OUTCOME } from '../script/frame'
import type { ScriptPort } from '../ports/scriptPort'

/** What a host installs while it has no sandbox. Named rather than hidden: no script runs. */
export function createInertScripts(): ScriptPort {
  return {
    seed: () => {},
    load: () => [],
    attach: () => [],
    detach: () => NO_OUTCOME,
    declares: () => false,
    run: () => NO_OUTCOME,
    deliver: () => NO_OUTCOME,
    refill: () => {},
    disarmed: () => [],
    dispose: () => {},
  }
}
