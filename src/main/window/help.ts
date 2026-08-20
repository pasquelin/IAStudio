import { CHANNELS } from '@shared/ipc'
import type { HelpPage } from '@shared/domain/window'
import { handle } from '@main/ipc/handle'
import { openLicencesWindow, openManualWindow, openUsageWindow } from './windows'

/**
 * The three windows of the Help menu, opened from anywhere rather than from that menu alone.
 *
 * Its own module for the reason `mirror.ts` gives: `windows.ts` already imports `controls.ts`,
 * and putting a handler there closes a cycle the main process reads at load time.
 */
const OPENERS: Record<HelpPage, () => void> = {
  manual: () => void openManualWindow(),
  licences: () => void openLicencesWindow(),
  usage: () => void openUsageWindow(),
}

export function registerHelpWindows(): void {
  handle(CHANNELS.helpOpen, (_event, page) => {
    OPENERS[page]()
    return Promise.resolve()
  })
}
