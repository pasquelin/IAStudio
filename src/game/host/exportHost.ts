// SPDX-License-Identifier: MIT

import type { GameApi } from '../api/gameApi'
import type { LogEntry } from '@shared/domain/gameRuntime'
import type { Player } from '../ports/netPort'
import type { PhysicsPort } from '../ports/physicsPort'
import { createBundledAssets } from './bundledAssets'
import { createDomInput, type DomInputTarget } from './domInput'
import { createInertAudio } from './inertAudio'
import { createInertPhysics } from './inertPhysics'
import { createInertRender } from './inertRender'
import { createRefusedAi } from './refusedAi'
import { createRingLog } from './ringLog'
import { createSoloNet } from './soloNet'

export type ExportHostDeps = {
  input: DomInputTarget
  player: Player
  /** Asset identifier → the file shipped beside the page. Written when the game is exported. */
  files: Readonly<Record<string, string>>
  /** What simulates. Absent until the engine's WebAssembly has landed — see `loadRapierPhysics`. */
  physics?: PhysicsPort
}

/** The seven ports with no studio, no protocol and no account. Two ports differ from the studio's. */
export function createExportHost(deps: ExportHostDeps): GameApi {
  const log = createRingLog(printed)

  return {
    assets: createBundledAssets(deps.files),
    input: createDomInput(deps.input),
    render: createInertRender(),
    physics: deps.physics ?? createInertPhysics(),
    audio: createInertAudio(),
    log,
    ai: createRefusedAi(log),
    net: createSoloNet(deps.player),
  }
}

/** An exported game has no journal to send a line to: what a browser shows is all there is. */
function printed(entry: LogEntry): void {
  if (entry.level === 'warn') console.warn(entry.message)
  if (entry.level === 'error') console.error(entry.message)
}
