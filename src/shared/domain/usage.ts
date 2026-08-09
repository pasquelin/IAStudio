import type { ApiFailure } from './failure'

/**
 * What the studio can report on its own spending, and what it deliberately cannot.
 *
 * The API exposes consumption, never a balance: there is no endpoint for remaining credits, no
 * quota, no subscription state. `maxConsumption` is a per-member cap set in the Scenario portal
 * and is not readable back. So every number here is money already spent — nothing in this file
 * can be turned into "how much is left".
 *
 * A report covers every stored account at once. The per-account totals are real; the grand
 * total is a studio-wide figure and matches no invoice, since each key carries its own project
 * and its own billing.
 */

/** How far back a report reaches, in days. 120 is the API's hard ceiling. */
export type UsagePeriod = 7 | 31 | 120

export const USAGE_PERIODS: readonly UsagePeriod[] = [7, 31, 120]

export const DEFAULT_USAGE_PERIOD: UsagePeriod = 31

/** Compute Units spent on one day, all accounts merged. */
export type DailySpend = {
  /** ISO date, day precision. */
  date: string
  units: number
}

/** What one stored account spent over the period. */
export type AccountSpend = {
  accountId: string
  name: string
  units: number
  discount: number
}

/**
 * One model's share of the spend, merged across every account that ran it.
 *
 * Merged by `modelId` alone: two accounts holding private models under similar names stay
 * distinct here, because their ids differ. Merging by name would invent a row.
 */
export type ModelSpend = {
  modelId: string
  /** The model's name when the API returned one, the raw id when it did not. */
  name: string
  units: number
  jobs: number
  /** Part of `units` spent through an API key rather than the web app. */
  apiKeyUnits: number
}

/**
 * A count under a label — one usage action (`images-generation`, `models-training`, …) or one
 * asset kind (`image`, `video`, `3d`, `audio`, …).
 *
 * `units` is absent for asset kinds: the API counts assets produced, and attributes cost to the
 * action that produced them, not to the file that came out.
 */
export type UsageTally = {
  label: string
  count: number
  units?: number
}

/**
 * The spending actions the API bills, as `usages.list` enumerates them. Listed so the report
 * reads in French instead of showing `images-generation`: closed unions, unlike a model's own
 * labels, so a bundle key per value is the right tool here.
 *
 * `creative-unit-cost` and `creative-unit-discount` are absent on purpose — they are the
 * synthesis lines the aggregate already folds into its own totals.
 */
export const USAGE_ACTIONS: readonly string[] = [
  'background-removal',
  'captioning',
  'custom',
  'custom-asset-created',
  'detection',
  'generators-training',
  'image-prompt-editing',
  'images-generation',
  'ip-detection',
  'models-training',
  'patch',
  'pixelate',
  'refunds',
  'repaint',
  'restyle',
  'segmentation',
  'skybox-base-360',
  'skybox-upscale-360',
  'texture',
  'upscale',
  'vectorization',
]

/** The asset kinds `usages.list` counts. Its own union, wider than the studio's own kinds. */
export const USAGE_ASSET_KINDS: readonly string[] = [
  '3d',
  'audio',
  'document',
  'image',
  'image-hdr',
  'json',
  'text',
  'video',
]

/**
 * Every action the raw activity log records, as `usages.list` enumerates them — a hundred of
 * them, and a different union from `USAGE_ACTIONS` above: that one is what gets BILLED, this
 * one is what HAPPENED. It carries events nothing charges for, from `subscription` to
 * `asset-privacy`.
 *
 * Listed so the journal reads in the language of the window rather than in the API’s own.
 */
export const USAGE_EVENT_ACTIONS: readonly string[] = [
  '3d',
  'asset',
  'asset-privacy',
  'assistant-message',
  'background-removal',
  'byok-remove-project-provider',
  'byok-remove-provider',
  'byok-set-project-provider',
  'byok-set-provider',
  'captioning',
  'collection',
  'collection-assets',
  'collection-models',
  'controlnet',
  'controlnet-img2img',
  'controlnet-inpaint',
  'controlnet-ip-adapter',
  'controlnet-texture',
  'copy-asset',
  'copy-model',
  'creative-unit-cost',
  'creative-unit-discount',
  'custom',
  'custom-asset-created',
  'delete-asset',
  'delete-collection',
  'delete-collection-assets',
  'delete-collection-models',
  'delete-inference-image',
  'delete-model',
  'delete-model-preset',
  'delete-oscu-auto-refill',
  'delete-project-member',
  'delete-subscription',
  'delete-team-api-key',
  'delete-team-invitations',
  'delete-team-member',
  'delete-training-images',
  'describe-style',
  'detection',
  'disable-project-model',
  'disable-team-model',
  'download-assets',
  'download-model',
  'embed',
  'enable-project-model',
  'enable-team-model',
  'generative-fill',
  'image-prompt-editing',
  'images-generation',
  'img2img',
  'img2img-ip-adapter',
  'img2img-texture',
  'inference',
  'inpaint',
  'inpaint-ip-adapter',
  'ip-detection',
  'model',
  'model-preset',
  'models-training',
  'oscu',
  'patch',
  'pixelate',
  'project',
  'project-member',
  'reframe',
  'refunds',
  'repaint',
  'restyle',
  'segmentation',
  'skybox-base-360',
  'skybox-upscale-360',
  'start-train',
  'subscription',
  'subscription-seats',
  'tag-asset',
  'tag-model',
  'team-api-key',
  'team-member',
  'texture',
  'train-succeeded',
  'training-images-to-model',
  'transfer-model',
  'txt2img',
  'txt2img-ip-adapter',
  'update-asset',
  'update-collection',
  'update-model',
  'update-model-description',
  'update-model-examples',
  'update-model-prompt-guide',
  'update-oscu-auto-refill',
  'update-project',
  'update-project-instructions',
  'update-subscription',
  'update-team',
  'update-team-instructions',
  'update-team-member',
  'upscale',
  'vectorization',
]

/** An account whose key refused the call. The report holds what the others answered. */
export type SilentAccount = {
  accountId: string
  name: string
  failure: ApiFailure
}

/**
 * The indicative euro value of a Compute Unit.
 *
 * Indicative is not a hedge: this comes from the public prepaid pack grid, which is tiered, and
 * says nothing about a subscription's own rate. Any screen showing a converted amount must say
 * so, or the figure lies.
 */
export type UnitPrice = {
  perUnit: number
  currency: string
}

/** Everything the four sections of the usage window paint, aggregated in the main process. */
export type UsageReport = {
  period: UsagePeriod
  /** ISO dates bounding what was asked, day precision. */
  from: string
  to: string
  units: number
  discount: number
  jobs: number
  daily: readonly DailySpend[]
  accounts: readonly AccountSpend[]
  /** Sorted by spend, descending. */
  models: readonly ModelSpend[]
  actions: readonly UsageTally[]
  assets: readonly UsageTally[]
  silent: readonly SilentAccount[]
  /** Null when the price grid could not be read — the window then shows units alone. */
  price: UnitPrice | null
}

/** One billable event, as the raw activity log records it. */
export type UsageEvent = {
  /** ISO timestamp. */
  time: string
  /**
   * Raw API action name (`images-generation`, `delete-asset`, `subscription`, …), shown as it
   * comes. Its union is ninety-nine values wide — the activity log, not the billing one — so it
   * is NOT the `USAGE_ACTIONS` list above, and the journal is the one usage surface still
   * reading in English.
   */
  action: string
  accountName: string
  modelName?: string
  jobId?: string
  /** Zero for the actions that carry no cost, such as tagging or deleting. */
  units: number
}

/**
 * Where each account's log has been read up to, by account id.
 *
 * One cursor per account rather than a single offset: `activityOffset` counts within one
 * account's own log, so a shared number applied to merged events would re-read what one key
 * already returned while skipping what another had not reached yet.
 *
 * Opaque to the renderer, which hands back what it was given.
 */
export type UsageCursors = Record<string, number>

/**
 * A slice of the activity log, paged rather than returned whole: over 120 days it is the one
 * section large enough to make opening the window slow, so it loads on demand.
 */
export type UsageEventPage = {
  events: readonly UsageEvent[]
  cursors: UsageCursors
  /** False once every account has run out — the API publishes no page size to compare against. */
  more: boolean
}

export const USAGE_ROUTE = 'usage'

export function isUsageRoute(hash: string): boolean {
  return hash.replace(/^#/, '') === USAGE_ROUTE
}
