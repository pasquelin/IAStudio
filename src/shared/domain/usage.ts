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
  /** Raw API action name (`images-generation`, `delete-asset`, …), translated on screen. */
  action: string
  accountName: string
  modelName?: string
  jobId?: string
  /** Zero for the actions that carry no cost, such as tagging or deleting. */
  units: number
}

/**
 * A slice of the activity log, which is paged rather than returned whole: over 120 days it is
 * the one section large enough to make opening the window slow, so it loads on demand.
 */
export type UsageEventPage = {
  events: readonly UsageEvent[]
  offset: number
  /** False once the API stops returning a full page. */
  more: boolean
}

export const USAGE_EVENT_PAGE_SIZE = 100

export const USAGE_ROUTE = 'usage'

export function isUsageRoute(hash: string): boolean {
  return hash.replace(/^#/, '') === USAGE_ROUTE
}
