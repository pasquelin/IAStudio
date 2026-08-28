import { CATALOGUE_FAMILIES, CODE_FAMILY, type ModelFamily } from './model'
import { ASSISTANT_ROLE, partsOfRole, type AiRoleId } from './aiRole'

/**
 * The clouds a role can be served by — a LIST, never a name in a branch.
 * What a cloud serves is DATA it declares here, so a role nothing lists is offered none.
 */
export type CloudProviderId = string

/** How the key is typed. Scenario is the only one that still takes a secret. */
export type CloudAuth = 'key' | 'key-secret'

/** How the assistant talks to it: Scenario's catalogue job, or HTTP chat. */
export type CloudChat =
  | { readonly kind: 'scenario' }
  | { readonly kind: 'openai'; readonly baseUrl: string; readonly model: string }
  | { readonly kind: 'anthropic'; readonly model: string }
  | { readonly kind: 'gemini'; readonly model: string }

export type HttpChat = Exclude<CloudChat, { kind: 'scenario' }>

export type CloudProvider = {
  readonly id: CloudProviderId
  /** The generation families it publishes. Its capabilities are the studio's own per family. */
  readonly families: readonly ModelFamily[]
  /** The standalone roles it serves. A role absent from every entry is local or nothing. */
  readonly standalone: readonly AiRoleId[]
  readonly auth: CloudAuth
  readonly chat: CloudChat
}

/** The one cloud the studio was built on: a stored key written before clouds were a list is one. */
export const SCENARIO_CLOUD: CloudProviderId = 'scenario'

/**
 * A cloud reached over HTTP chat: it answers the assistant, and it writes code.
 *
 * The two go together because they are ONE round trip — a chat that can hold a conversation can
 * be asked for a function, and refusing it the code family would have meant a second key, for the
 * same account, on the same endpoint. Its families are `code` alone: none of them publishes an
 * image, so none of them holds a library to browse.
 */
function chatCloud(id: CloudProviderId, chat: HttpChat): CloudProvider {
  return { id, families: [CODE_FAMILY], standalone: [ASSISTANT_ROLE], auth: 'key', chat }
}

/**
 * The registry, and the ONE place a cloud is named. Scenario serves asset generation and the
 * assistant; the others answer over chat, which is what serves the assistant and the code family.
 * Dictation is absent.
 *
 * 🛑 Scenario does NOT declare `code`, and it is not an oversight to correct: its catalogue
 * publishes no code model and its capability enum holds no code value, so the family would open a
 * picker with nothing in it.
 */
export const CLOUD_PROVIDERS: readonly CloudProvider[] = [
  {
    id: SCENARIO_CLOUD,
    families: CATALOGUE_FAMILIES,
    standalone: [ASSISTANT_ROLE],
    auth: 'key-secret',
    chat: { kind: 'scenario' },
  },
  chatCloud('openai', {
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  }),
  chatCloud('anthropic', { kind: 'anthropic', model: 'claude-sonnet-4-5' }),
  chatCloud('google', { kind: 'gemini', model: 'gemini-2.0-flash' }),
  chatCloud('deepseek', {
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  }),
  chatCloud('xai', { kind: 'openai', baseUrl: 'https://api.x.ai/v1', model: 'grok-3-mini' }),
  chatCloud('mistral', {
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
  }),
  chatCloud('openrouter', {
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
  }),
]

export const CLOUD_IDS: readonly CloudProviderId[] = CLOUD_PROVIDERS.map(one => one.id)

/**
 * The clouds that hold a LIBRARY of assets, rather than only a key a chat talks through.
 *
 * 🛑 `families.length > 0` is not the test since the chat clouds gained `code`: it would have put
 * eight browsers of nothing beside the one that lists something.
 */
export const ASSET_CLOUDS: readonly CloudProviderId[] = CLOUD_PROVIDERS.filter(cloud =>
  cloud.families.some(family => CATALOGUE_FAMILIES.includes(family)),
).map(cloud => cloud.id)

/** Whether a cloud publishes what this role asks for, read off its declaration. */
function serves(cloud: CloudProvider, role: AiRoleId): boolean {
  const parts = partsOfRole(role)

  return parts === null ? cloud.standalone.includes(role) : cloud.families.includes(parts.family)
}

/** The clouds that could serve a role at all, before any account is held. */
export function cloudsServing(role: AiRoleId): readonly CloudProviderId[] {
  return CLOUD_PROVIDERS.filter(cloud => serves(cloud, role)).map(cloud => cloud.id)
}

/** A cloud id that came from outside the type system — a stored choice, an IPC payload. */
export function isCloudProviderId(value: unknown): value is CloudProviderId {
  return CLOUD_IDS.some(id => id === value)
}

/**
 * The model a cloud declares, and the reading of "is this cloud talked to over HTTP at all":
 * `null` for one whose thinking goes through the catalogue instead.
 */
export function defaultChatModel(id: CloudProviderId): string | null {
  const chat = CLOUD_PROVIDERS.find(one => one.id === id)?.chat
  return chat === undefined || chat.kind === 'scenario' ? null : chat.model
}

/** Which model a cloud answers with. A name typed and then emptied is an absent one. */
export function chatModelOf(chosen: string | undefined, declared: string): string {
  return chosen?.trim() || declared
}

/** How the key is typed. An unknown id is treated as Scenario — the stored default. */
export function cloudAuth(id: CloudProviderId): CloudAuth {
  return CLOUD_PROVIDERS.find(one => one.id === id)?.auth ?? 'key-secret'
}
