import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { DEFAULT_SETTINGS, type PartialSettings } from '@shared/domain/settings'
import { getBridge } from '@/services/bridge'
import { withBridge, type ActionHandlers } from './actionHandler'
import { recordOf, textOf } from './actionInputs'

/** The settings and the account, read and set from outside the window. */

/**
 * Narrowed before it is sent, and that check is the whole of what stands between a client and
 * the settings file: `write` takes a `PartialSettings` the main process merges branch by branch,
 * and a branch it does not know travels through unread — so a client that misspelt a section
 * would be told the change took.
 */
function write(input: Record<string, unknown>): Promise<ActionOutcome> {
  const asked: PartialSettings | null = recordOf(input, 'settings')
  if (!asked || !Object.keys(asked).every(section => section in DEFAULT_SETTINGS)) {
    return Promise.resolve(refused('badInput'))
  }

  return withBridge(bridge => bridge.settings.write(asked))
}

async function activate(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge')

  const accountId = textOf(input, 'accountId') ?? ''
  const known = await bridge.accounts.list()
  if (!known.some(account => account.id === accountId)) return refused('badInput')

  return { ok: true, data: await bridge.accounts.activate(accountId) }
}

export const SETTINGS_HANDLERS: ActionHandlers = {
  'settings.read': () => withBridge(bridge => bridge.settings.read()),
  'settings.write': write,
  'accounts.list': () => withBridge(bridge => bridge.accounts.list()),
  'accounts.activate': activate,
}
