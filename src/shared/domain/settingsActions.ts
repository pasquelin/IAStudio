import { action, type AssistantAction } from './assistantAction'
import { DEFAULT_SETTINGS } from './settings'

/**
 * The studio's own settings, and which account it works through.
 *
 * `accounts.add` and `accounts.remove` are NOT here. Adding one takes an API key and a secret,
 * which the renderer may hold for exactly as long as it takes to hand them over and never read
 * back — a channel that took them from an outside client would be a way of writing a credential
 * into a studio through a port. Removing one destroys the only copy of it this machine has.
 */
export const SETTINGS_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'settings.read',
    titleKey: 'assistant.actions.settingsRead.title',
    descriptionKey: 'assistant.actions.settingsRead.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    /**
     * `record` rather than `raw`, which published no type at all: `PartialSettings` is a static
     * union of this repository, not a shape discovered at runtime, so a client can be told both
     * that it is an object and which sections it may name. The main process merges branch by
     * branch, so what is not named is not touched.
     */
    name: 'settings.write',
    titleKey: 'assistant.actions.settingsWrite.title',
    descriptionKey: 'assistant.actions.settingsWrite.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'settings',
        kind: 'record',
        labelKey: 'assistant.fields.settings',
        required: true,
        options: Object.keys(DEFAULT_SETTINGS),
      },
    ],
  }),
  action({
    name: 'accounts.list',
    titleKey: 'assistant.actions.accountsList.title',
    descriptionKey: 'assistant.actions.accountsList.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'accounts.activate',
    titleKey: 'assistant.actions.accountsActivate.title',
    descriptionKey: 'assistant.actions.accountsActivate.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'accountId', kind: 'text', labelKey: 'assistant.fields.accountId', required: true },
    ],
  }),
]
