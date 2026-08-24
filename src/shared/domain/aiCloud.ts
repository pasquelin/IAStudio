import { MODEL_FAMILIES, type ModelFamily } from './model'
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

function assistantCloud(id: CloudProviderId, chat: HttpChat): CloudProvider {
  return { id, families: [], standalone: [ASSISTANT_ROLE], auth: 'key', chat }
}

/**
 * The registry, and the ONE place a cloud is named. Scenario serves generation and the assistant;
 * the others hold a chat key for the assistant only. Dictation is absent.
 */
export const CLOUD_PROVIDERS: readonly CloudProvider[] = [
  {
    id: SCENARIO_CLOUD,
    families: MODEL_FAMILIES,
    standalone: [ASSISTANT_ROLE],
    auth: 'key-secret',
    chat: { kind: 'scenario' },
  },
  assistantCloud('openai', {
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  }),
  assistantCloud('anthropic', { kind: 'anthropic', model: 'claude-sonnet-4-5' }),
  assistantCloud('google', { kind: 'gemini', model: 'gemini-2.0-flash' }),
  assistantCloud('deepseek', {
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  }),
  assistantCloud('xai', { kind: 'openai', baseUrl: 'https://api.x.ai/v1', model: 'grok-3-mini' }),
  assistantCloud('mistral', {
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
  }),
  assistantCloud('openrouter', {
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
  }),
]

export const CLOUD_IDS: readonly CloudProviderId[] = CLOUD_PROVIDERS.map(one => one.id)

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
