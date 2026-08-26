// SPDX-License-Identifier: MIT

import type { GameApi } from '../api/gameApi'
import { createExportHost } from '../host/exportHost'
import { createWorld, type World, type WorldOptions } from './world'
import { STEP_SECONDS } from './gameLoop'

function testPorts(): GameApi {
  return createExportHost({
    input: document.createElement('div'),
    player: { id: 'p1', name: 'Alba', local: true },
    files: {},
  })
}

export function testWorld(over: Partial<WorldOptions> = {}): World {
  return createWorld({
    scene: { kind: 'document', id: 'scene_1' },
    ports: testPorts(),
    systems: [],
    seed: 1,
    step: STEP_SECONDS,
    ...over,
  })
}
