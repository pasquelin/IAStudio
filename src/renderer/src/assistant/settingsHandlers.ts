import type { ActionOutcome, ActionRefusal } from '@shared/domain/assistant'
import { mergePartial, type PartialSettings } from '@shared/domain/settings'
import { getBridge } from '@/services/bridge'
import type { ActionHandlers } from './actionHandler'
import { recordOf, textOf } from './actionInputs'

/** The settings and the account, read and set from outside the window. */

const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

async function write(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  const asked = recordOf(input, 'settings')
  if (!bridge) return refused('noBridge')
  if (!asked) return refused('badInput')

  /**
   * Narrowed against the current settings before it is sent, and that check is the whole of what
   * stands between a client and the settings file: `write` takes a `PartialSettings` the main
   * process merges branch by branch, and a branch it does not know is written through unread.
   */
  const settings = await bridge.settings.read()
  const partial: PartialSettings = asked
  if (JSON.stringify(mergePartial(settings, partial)) === JSON.stringify(settings)) {
    return refused('badInput')
  }

  return { ok: true, data: await bridge.settings.write(partial) }
}

async function activate(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  const accountId = textOf(input, 'accountId')
  if (!bridge) return refused('noBridge')
  if (accountId === null) return refused('badInput')

  const known = await bridge.accounts.list()
  if (!known.some(account => account.id === accountId)) return refused('badInput')

  return { ok: true, data: await bridge.accounts.activate(accountId) }
}

export const SETTINGS_HANDLERS: ActionHandlers = {
  'settings.read': async () => {
    const bridge = getBridge()
    return bridge ? { ok: true, data: await bridge.settings.read() } : refused('noBridge')
  },
  'settings.write': write,
  'accounts.list': async () => {
    const bridge = getBridge()
    return bridge ? { ok: true, data: await bridge.accounts.list() } : refused('noBridge')
  },
  'accounts.activate': activate,
}
