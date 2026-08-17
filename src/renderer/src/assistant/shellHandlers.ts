import { refused } from '@shared/domain/assistant'
import { isSettingsSection } from '@shared/domain/settings'
import { withBridge, type ActionHandlers } from './actionHandler'
import { textOf } from './actionInputs'

/**
 * The window, the account and the small lists the studio keeps outside every project.
 *
 * Every one of these is a pass-through to a channel of `shared/ipc.ts`, and that is the whole of
 * what they are: the work already lives in the main process, it simply had no door.
 */

export const SHELL_HANDLERS: ActionHandlers = {
  'auth.state': () => withBridge(bridge => bridge.settings.authState()),
  'updates.state': () => withBridge(bridge => bridge.updates.state()),
  'media.capabilities': () => withBridge(bridge => bridge.media.capabilities()),
  'fonts.list': () => withBridge(bridge => bridge.fonts.list()),
  'favorites.list': () => withBridge(bridge => bridge.favorites.list()),
  'mirror.open': () => withBridge(bridge => bridge.mirror.open()),
  'window.fullScreen': () => withBridge(bridge => bridge.window.toggleFullScreen()),

  /**
   * The window AND the language it draws in, in one answer: the language is resolved by the main
   * process — the setting may say `system`, and only that side sees what the machine prefers.
   */
  'window.state': () =>
    withBridge(async bridge => ({
      ...(await bridge.window.state()),
      language: await bridge.window.language(),
    })),

  'settings.open': input => {
    const section = textOf(input, 'section')
    return isSettingsSection(section)
      ? withBridge(bridge => bridge.settings.open(section))
      : Promise.resolve(refused('badInput'))
  },

  /**
   * Answers the row itself rather than `ok` alone: `adopt` gives back `null` for a file the
   * studio cannot read, and a client told only "done" would go looking for an asset that was
   * never created.
   */
  'media.adopt': async input => {
    const outcome = await withBridge(bridge => bridge.media.adopt(textOf(input, 'path') ?? ''))
    return outcome.ok && outcome.data === null ? refused('badInput') : outcome
  },

  'favorite.pin': input =>
    withBridge(bridge => bridge.favorites.pin(textOf(input, 'assetId') ?? '')),

  'favorite.unpin': input =>
    withBridge(bridge => bridge.favorites.unpin(textOf(input, 'favoriteId') ?? '')),

  'fileInfo.open': input => withBridge(bridge => bridge.fileInfo.open(textOf(input, 'path') ?? '')),
}
