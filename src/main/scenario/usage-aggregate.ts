import {
  dayOf,
  type AccountSpend,
  type DailySpend,
  type ModelSpend,
  type SilentAccount,
  type UnitPrice,
  type UsageEvent,
  type UsagePeriod,
  type UsageReport,
  type UsageTally,
} from '@shared/domain/usage'
import { byCodeUnit } from '@shared/text'

/**
 * The shape read out of `usages.list`, narrowed to what is painted.
 *
 * Declared structurally rather than imported from the SDK so the aggregation can be tested
 * without a network or a client. Field optionality mirrors `UsageListResponse` exactly — widen
 * anything here and a real response stops being assignable.
 */
export type UsageData = {
  usages?: Array<{
    usageName: string
    points: Array<{ time: string; value: string; cost?: number; discount?: number }>
  }>
  modelUsages?: Array<{
    modelId: string
    points: Array<{
      time: string
      cost: number
      discount: number
      jobs: number
      apiKeyCost: number
    }>
  }>
  assetUsages?: Array<{ kind: string; points: Array<{ time: string; count: number }> }>
  activity?: Array<{
    action: string
    time: string
    data: { modelId?: string; jobId?: string }
    creativeUnitsCost?: number
  }>
  entities?: { models?: Array<{ id: string; name: string }> }
}

/** What one account answered, or why it did not. */
export type AccountUsage = {
  accountId: string
  name: string
  data: UsageData | null
  failure?: SilentAccount['failure']
}

/**
 * Synthesis rows, excluded from every total.
 *
 * `creative-unit-cost` and `creative-unit-discount` restate what the other usage names already
 * carry. Summing them alongside would count the same units twice.
 */
const SYNTHESIS_USAGES: readonly string[] = ['creative-unit-cost', 'creative-unit-discount']

const isSpend = (usageName: string): boolean => !SYNTHESIS_USAGES.includes(usageName)

/** A count the API sends as a string; anything unparseable counts as nothing. */
function countOf(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function addTo(totals: Map<string, number>, key: string, amount: number): void {
  totals.set(key, (totals.get(key) ?? 0) + amount)
}

/**
 * The window the API is asked for.
 *
 * Bounds are explicit rather than `timeRange`: that parameter stops at
 * `last-thirty-one-days`, and 120 days — the API's own ceiling — has no value for it.
 */
export function periodBounds(period: UsagePeriod, now: Date): { from: string; to: string } {
  const from = new Date(now)
  // Inclusive of today, so a 7-day period spans today and the six days before it.
  from.setUTCDate(from.getUTCDate() - (period - 1))
  return { from: dayOf(from.toISOString()), to: dayOf(now.toISOString()) }
}

function spendOf(data: UsageData): { units: number; discount: number } {
  let units = 0
  let discount = 0

  for (const usage of data.usages ?? []) {
    if (!isSpend(usage.usageName)) continue
    for (const point of usage.points) {
      units += point.cost ?? 0
      discount += point.discount ?? 0
    }
  }

  return { units, discount }
}

function dailyOf(accounts: readonly AccountUsage[]): DailySpend[] {
  const perDay = new Map<string, number>()

  for (const account of accounts) {
    for (const usage of account.data?.usages ?? []) {
      if (!isSpend(usage.usageName)) continue
      for (const point of usage.points) addTo(perDay, dayOf(point.time), point.cost ?? 0)
    }
  }

  return [...perDay]
    .map(([date, units]) => ({ date, units }))
    .sort((left, right) => byCodeUnit(left.date, right.date))
}

/**
 * Models merged across accounts by id alone.
 *
 * Never by name: two accounts can hold private models named alike, and merging those would
 * report a row for a model nobody ran.
 */
function modelsOf(accounts: readonly AccountUsage[]): ModelSpend[] {
  const units = new Map<string, number>()
  const jobs = new Map<string, number>()
  const apiKeyUnits = new Map<string, number>()
  const names = new Map<string, string>()

  for (const account of accounts) {
    for (const model of account.data?.entities?.models ?? []) names.set(model.id, model.name)

    for (const usage of account.data?.modelUsages ?? []) {
      for (const point of usage.points) {
        addTo(units, usage.modelId, point.cost)
        addTo(jobs, usage.modelId, point.jobs)
        addTo(apiKeyUnits, usage.modelId, point.apiKeyCost)
      }
    }
  }

  return [...units]
    .map(([modelId, spent]) => ({
      modelId,
      name: names.get(modelId) ?? modelId,
      units: spent,
      jobs: jobs.get(modelId) ?? 0,
      apiKeyUnits: apiKeyUnits.get(modelId) ?? 0,
    }))
    .sort((left, right) => right.units - left.units)
}

function actionsOf(accounts: readonly AccountUsage[]): UsageTally[] {
  const counts = new Map<string, number>()
  const units = new Map<string, number>()

  for (const account of accounts) {
    for (const usage of account.data?.usages ?? []) {
      if (!isSpend(usage.usageName)) continue
      for (const point of usage.points) {
        addTo(counts, usage.usageName, countOf(point.value))
        addTo(units, usage.usageName, point.cost ?? 0)
      }
    }
  }

  return [...counts]
    .map(([label, count]) => ({ label, count, units: units.get(label) ?? 0 }))
    .filter(tally => tally.count > 0 || (tally.units ?? 0) > 0)
    .sort((left, right) => (right.units ?? 0) - (left.units ?? 0))
}

/** Asset kinds carry a count and no cost: the API bills the action, not the file it produced. */
function assetsOf(accounts: readonly AccountUsage[]): UsageTally[] {
  const counts = new Map<string, number>()

  for (const account of accounts) {
    for (const usage of account.data?.assetUsages ?? []) {
      for (const point of usage.points) addTo(counts, usage.kind, point.count)
    }
  }

  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .filter(tally => tally.count > 0)
    .sort((left, right) => right.count - left.count)
}

function jobsOf(accounts: readonly AccountUsage[]): number {
  let total = 0
  for (const account of accounts) {
    for (const usage of account.data?.modelUsages ?? []) {
      for (const point of usage.points) total += point.jobs
    }
  }
  return total
}

function accountSpendOf(accounts: readonly AccountUsage[]): AccountSpend[] {
  return accounts
    .flatMap(account =>
      account.data
        ? [{ accountId: account.accountId, name: account.name, ...spendOf(account.data) }]
        : [],
    )
    .sort((left, right) => right.units - left.units)
}

function silentOf(accounts: readonly AccountUsage[]): SilentAccount[] {
  return accounts
    .filter(account => account.data === null)
    .map(account => ({
      accountId: account.accountId,
      name: account.name,
      failure: account.failure ?? 'unexpected',
    }))
}

export function aggregate(
  accounts: readonly AccountUsage[],
  period: UsagePeriod,
  bounds: { from: string; to: string },
  price: UnitPrice | null,
): UsageReport {
  const spend = accountSpendOf(accounts)

  return {
    period,
    from: bounds.from,
    to: bounds.to,
    units: spend.reduce((total, account) => total + account.units, 0),
    discount: spend.reduce((total, account) => total + account.discount, 0),
    jobs: jobsOf(accounts),
    daily: dailyOf(accounts),
    accounts: spend,
    models: modelsOf(accounts),
    actions: actionsOf(accounts),
    assets: assetsOf(accounts),
    silent: silentOf(accounts),
    price,
  }
}

/** The raw log, flattened across accounts and sorted newest first. */
export function eventsOf(accounts: readonly AccountUsage[]): UsageEvent[] {
  const events: UsageEvent[] = []

  for (const account of accounts) {
    const names = new Map(account.data?.entities?.models?.map(model => [model.id, model.name]))

    for (const entry of account.data?.activity ?? []) {
      const modelName = entry.data.modelId
        ? (names.get(entry.data.modelId) ?? entry.data.modelId)
        : undefined

      events.push({
        time: entry.time,
        action: entry.action,
        accountName: account.name,
        units: entry.creativeUnitsCost ?? 0,
        ...(modelName ? { modelName } : {}),
        ...(entry.data.jobId ? { jobId: entry.data.jobId } : {}),
      })
    }
  }

  return events.sort((left, right) => byCodeUnit(right.time, left.time))
}
