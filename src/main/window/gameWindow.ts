import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { closeGameWindow, openGameWindow } from './windows'

/**
 * Opening the game window and closing it — all this side owns. Its own module for the reason
 * `mirror.ts` gives, and what the game PLAYS goes straight between the windows on `gameChannel`.
 */
export function registerGameWindow(): void {
  handle(CHANNELS.gameWindowOpen, () => {
    openGameWindow()
    return Promise.resolve()
  })

  handle(CHANNELS.gameWindowClose, () => {
    closeGameWindow()
    return Promise.resolve()
  })
}
