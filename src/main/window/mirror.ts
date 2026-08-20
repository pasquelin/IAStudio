import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { openMirrorWindow } from './windows'

/**
 * The one thing the video return needs from this side: a window.
 *
 * Its own module rather than a line in `controls.ts`, which `windows.ts` already imports for
 * `trackWindowState` — putting it there closes a cycle between the two, and a cycle in the main
 * process is read at load time, before anything can report on it.
 *
 * What the return SHOWS never passes through here. Both windows run the same renderer bundle and
 * publish to each other directly — see `spaces/video/mirrorChannel`.
 */
export function registerMirrorWindow(): void {
  handle(CHANNELS.mirrorOpen, () => {
    openMirrorWindow()
    return Promise.resolve()
  })
}
