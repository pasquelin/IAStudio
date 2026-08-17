import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { PartialSettings } from '@shared/domain/settings'
import { getBridge } from '@/services/bridge'
import { withBridge, type ActionHandlers } from './actionHandler'
import { recordOf, textOf } from './actionInputs'

/** The settings and the account, read and set from outside the window. */

/**
 * The section names are checked by `validatesInput`, from the `record` field's own key list —
 * `write` takes a `PartialSettings` the main process merges branch by branch, and a branch it
 * does not know travels through unread, so a misspelt section would be answered `ok`.
 *
 * The blind spot, written rather than hidden: only section NAMES are checked. A misspelt field
 * inside a known section is stripped by the schema in the main process and still answered `ok`.
 * Checking fields against `DEFAULT_SETTINGS` cannot close it — `media` and `git` default to `{}`
 * while carrying optional fields, so every legitimate write to those two would be refused.
 */
function write(input: Record<string, unknown>): Promise<ActionOutcome> {
  const asked: PartialSettings | null = recordOf(input, 'settings')
  if (!asked) return Promise.resolve(refused('badInput'))

  // The one branch this action may not touch, and the reason the delegation is worth anything: a
  // client that could raise its own budget or tick its own boxes would be asking itself. Only the
  // settings window arms it — `settings.open` is published, and that is the whole of the way in.
  if (Object.keys(asked.mcp ?? {}).some(key => key.startsWith('delegate'))) {
    return Promise.resolve(refused('notAllowed'))
  }

  return withBridge(bridge => bridge.settings.write(asked))
}

async function activate(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge')

  const accountId = textOf(input, 'accountId') ?? ''
  const known = await bridge.accounts.list()
  if (!known.some(account => account.id === accountId)) return refused('notFound')

  return { ok: true, data: await bridge.accounts.activate(accountId) }
}

export const SETTINGS_HANDLERS: ActionHandlers = {
  'settings.read': () => withBridge(bridge => bridge.settings.read()),
  'settings.write': write,
  'accounts.list': () => withBridge(bridge => bridge.accounts.list()),
  'accounts.activate': activate,
}
