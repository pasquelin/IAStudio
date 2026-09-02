import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { parseAssetId } from '@main/assets/validation'
import { openCharacterWindow } from './windows'

/**
 * Opening the skeleton window — all this side owns. Its own module for the reason `mirror.ts`
 * gives, and what the window EDITS goes straight between the windows on `characterChannel`.
 */
export function registerCharacterWindow(): void {
  handle(CHANNELS.characterWindowOpen, (_event, assetId) => {
    openCharacterWindow(parseAssetId(assetId))
    return Promise.resolve()
  })
}
