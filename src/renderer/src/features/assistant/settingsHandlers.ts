import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { PartialSettings } from '@shared/domain/settings'
import { SETTING_ACTION_IDS } from '@shared/domain/settingAction'
import { getBridge } from '@/services/bridge'
import { withBridge, type ActionHandlers } from './actionHandler'
import { oneOf, recordOf, textOf } from './actionInputs'

/** The settings and the account, read and set from outside the window. */

const NO_BRIDGE = 'this window is not connected to the studio process'

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
  if (!asked)
    return Promise.resolve(
      refused(
        'badInput',
        '"settings" is wanted, as a record of settings sections — settings.read answers the shape it takes',
      ),
    )

  // The one branch this action may not touch, and the reason the delegation is worth anything: a
  // client that could raise its own budget or tick its own boxes would be asking itself. Only the
  // settings window arms it — `settings.open` is published, and that is the whole of the way in.
  if (Object.keys(asked.mcp ?? {}).some(key => key.startsWith('delegate'))) {
    return Promise.resolve(
      refused(
        'notAllowed',
        'the "delegate" switches of the mcp section are not writable from here — only the settings window arms them, and settings.open raises it',
      ),
    )
  }

  return withBridge(bridge => bridge.settings.write(asked))
}

async function activate(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge', NO_BRIDGE)

  const accountId = textOf(input, 'accountId') ?? ''
  const known = await bridge.accounts.list()
  if (!known.some(account => account.id === accountId))
    return refused(
      'notFound',
      `no account "${accountId}" on this machine — accounts.list answers which there are, with their ids`,
    )

  return { ok: true, data: await bridge.accounts.activate(accountId) }
}

export const SETTINGS_HANDLERS: ActionHandlers = {
  'settings.read': () => withBridge(bridge => bridge.settings.read()),
  'settings.write': write,
  'accounts.list': () => withBridge(bridge => bridge.accounts.list()),
  'accounts.activate': activate,

  /**
   * The refusal travels IN the answer — an unknown id, a name already taken, the account the
   * `.env` file holds — so `ok` here would be `ok` on a rename that never happened.
   */
  'accounts.rename': async input => {
    const bridge = getBridge()
    if (!bridge) return refused('noBridge', NO_BRIDGE)

    const result = await bridge.accounts.rename(
      textOf(input, 'accountId') ?? '',
      textOf(input, 'name') ?? '',
    )
    return result.failure
      ? refused(
          'notAllowed',
          `the account was not renamed: ${result.failure} — accounts.list answers which there are, with their ids and their names`,
        )
      : { ok: true, data: result.accounts }
  },

  'settings.triggerAction': input => {
    const id = oneOf(input, 'action', SETTING_ACTION_IDS)
    return id
      ? withBridge(bridge => bridge.settings.runAction(id))
      : Promise.resolve(
          refused('badInput', `"action" wants one of: ${SETTING_ACTION_IDS.join(', ')}`),
        )
  },
}
