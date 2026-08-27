// SPDX-License-Identifier: MIT

import type { LogPort } from '../ports/logPort'
import type { ScenePort } from '../ports/scenePort'
import { createKeptStore } from './keptStore'

/** What a host installs while it holds one scene and no way to reach another — a bench, a test. */
export function createSingleScene(log: LogPort): ScenePort {
  const store = createKeptStore()

  return {
    load: scene => log.write('warn', `this host holds one scene, not "${scene}"`),
    keep: store.keep,
    kept: store.kept,
  }
}
