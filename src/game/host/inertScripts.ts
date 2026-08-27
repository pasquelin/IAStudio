// SPDX-License-Identifier: MIT

import type { ScriptPort } from '../ports/scriptPort'

const NOTHING = { intents: [], faults: [] }

/** What a host installs while it has no sandbox. Named rather than hidden: no script runs. */
export function createInertScripts(): ScriptPort {
  return {
    seed: () => {},
    load: () => [],
    attach: () => [],
    detach: () => {},
    run: () => NOTHING,
    deliver: () => NOTHING,
    disarmed: () => [],
    dispose: () => {},
  }
}
