import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { parseFolderPath } from '@main/project/validation'
import { openFileInfoWindow } from './windows'

/**
 * The one thing a file's information window needs from this side: a window.
 *
 * Its own module for the reason `mirror.ts` is one — registering from `windows.ts` closes a
 * cycle through `controls.ts`, read at load time. The path is parsed although nothing is read
 * with it: a fragment is the one thing a window is handed that no later parser has to see.
 */
export function registerFileInfoWindow(): void {
  handle(CHANNELS.fileInfoOpen, (_event, relative) => {
    openFileInfoWindow(parseFolderPath(relative))
    return Promise.resolve()
  })
}
