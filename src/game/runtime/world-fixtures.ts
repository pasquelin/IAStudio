// SPDX-License-Identifier: MIT

import { DEFAULT_PLAY } from '@shared/domain/scene'
import type { GameApi } from '../api/gameApi'
import { createExportHost } from '../host/exportHost'
import { createWorld, type World, type WorldOptions } from './world'
import { STEP_SECONDS } from './gameLoop'

export function testPorts(over: Partial<GameApi> = {}): GameApi {
  return {
    ...createExportHost({
      input: document.createElement('div'),
      player: { id: 'p1', name: 'Alba', local: true },
      files: {},
    }),
    ...over,
  }
}

export function testWorld(over: Partial<WorldOptions> = {}): World {
  return createWorld({
    scene: { kind: 'document', id: 'scene_1' },
    ports: testPorts(),
    systems: [],
    seed: 1,
    step: STEP_SECONDS,
    play: DEFAULT_PLAY,
    ...over,
  })
}
