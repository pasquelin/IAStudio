// SPDX-License-Identifier: MIT

import type { GameApi } from '../api/gameApi'
import type { LogEntry } from '@shared/domain/gameRuntime'
import type { Player } from '../ports/netPort'
import type { RenderPort } from '../ports/renderPort'
import { createDomInput, type DomInputTarget } from './domInput'
import { createHostedAssets } from './hostedAssets'
import { createInertAudio } from './inertAudio'
import { createInertRender } from './inertRender'
import { createRefusedAi } from './refusedAi'
import { createRingLog } from './ringLog'
import { createSoloNet } from './soloNet'

export type StudioHostDeps = {
  input: DomInputTarget
  player: Player
  /** What draws. Absent while a host has no viewport to give — see `createInertRender`. */
  render?: RenderPort
  /** How the studio spells an asset URL — `assetUrl` from `@shared/domain/asset`. */
  urlForAsset: (id: string) => string
  /**
   * Where a line ALSO goes. The journal lives in the main process and nothing here may reach it,
   * so the window that opens the game passes the way in.
   */
  journal?: (entry: LogEntry) => void
}

/** The seven ports as the studio fills them. What is inert here says so where it is written. */
export function createStudioHost(deps: StudioHostDeps): GameApi {
  const log = createRingLog(deps.journal)

  return {
    assets: createHostedAssets(deps.urlForAsset),
    input: createDomInput(deps.input),
    render: deps.render ?? createInertRender(),
    audio: createInertAudio(),
    log,
    ai: createRefusedAi(log),
    net: createSoloNet(deps.player),
  }
}
