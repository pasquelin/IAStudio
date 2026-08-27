// SPDX-License-Identifier: MIT

import type { GameApi } from '../api/gameApi'
import type { AssetPort } from '../ports/assetPort'
import type { LogEntry } from '@shared/domain/gameRuntime'
import type { Player } from '../ports/netPort'
import type { PhysicsPort } from '../ports/physicsPort'
import type { RenderPort } from '../ports/renderPort'
import type { ScenePort } from '../ports/scenePort'
import type { ScriptPort } from '../ports/scriptPort'
import { createBundledAssets } from './bundledAssets'
import { createDomInput, type DomInputTarget } from './domInput'
import { createInertAudio } from './inertAudio'
import { createInertPhysics } from './inertPhysics'
import { createInertScripts } from './inertScripts'
import { createInertRender } from './inertRender'
import { createRefusedAi } from './refusedAi'
import { createRingLog } from './ringLog'
import { createSingleScene } from './singleScene'
import { createSoloNet } from './soloNet'

export type ExportHostDeps = {
  input: DomInputTarget
  player: Player
  /** Asset identifier → the file shipped beside the page. Written when the game is exported. */
  files: Readonly<Record<string, string>>
  /** What simulates. Absent until the engine's WebAssembly has landed — see `loadRapierPhysics`. */
  physics?: PhysicsPort
  /** Where a game's own code runs. Absent leaves every script silent — see `loadQuickjsScripts`. */
  script?: ScriptPort
  /** What draws. Absent draws nothing at all — see `createInertRender`. */
  render?: RenderPort
  /** The same table as `files`, when a caller already built one and draws through it. */
  assets?: AssetPort
  /** Where the game's other scenes come from. Absent holds it to the one it opened on. */
  scenes?: ScenePort
}

/** Every port with no studio, no protocol and no account. Two of them differ from the studio's. */
export function createExportHost(deps: ExportHostDeps): GameApi {
  const log = createRingLog(printed)

  return {
    assets: deps.assets ?? createBundledAssets(deps.files),
    input: createDomInput(deps.input),
    render: deps.render ?? createInertRender(),
    physics: deps.physics ?? createInertPhysics(),
    script: deps.script ?? createInertScripts(),
    scenes: deps.scenes ?? createSingleScene(log),
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
