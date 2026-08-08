import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { Updates } from '@main/updater'

export type UpdateHandlerDeps = { updates: Updates }

export function registerUpdateHandlers({ updates }: UpdateHandlerDeps): void {
  handle(CHANNELS.updateState, () => updates.state())
  handle(CHANNELS.updateInstall, () => {
    updates.install()
  })
}
