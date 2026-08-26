// SPDX-License-Identifier: MIT

import type { AiPort } from '../ports/aiPort'
import type { AssetPort } from '../ports/assetPort'
import type { AudioPort } from '../ports/audioPort'
import type { InputPort } from '../ports/inputPort'
import type { LogPort } from '../ports/logPort'
import type { NetPort } from '../ports/netPort'
import type { RenderPort } from '../ports/renderPort'

/**
 * What a script sees as `game`. A runtime inside the studio and one inside an exported game
 * differ by what fills this and by nothing else — hence `main/game-imports.test.ts`.
 */
export type GameApi = {
  assets: AssetPort
  input: InputPort
  render: RenderPort
  audio: AudioPort
  log: LogPort
  ai: AiPort
  net: NetPort
}
