import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { parseAssetId } from '@main/assets/validation'
import { openPlayerModuleWindow } from './windows'

/** Opening the module window — all this side owns, as `gameWindow.ts` explains for its own. */
export function registerPlayerModuleWindow(): void {
  handle(CHANNELS.playerModuleWindowOpen, (_event, assetId) => {
    openPlayerModuleWindow(parseAssetId(assetId))
    return Promise.resolve()
  })
}
