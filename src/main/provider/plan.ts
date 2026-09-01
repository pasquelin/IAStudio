import { levelOfPlan, type PlanAccess } from '@shared/domain/plan'
import { log } from '@main/log'
import { describeFailure } from './client'
import type { WatchCredentials } from './credentialsWatch'

/**
 * What `GET /teams` answers, reduced to the one field the studio reads. Narrower than the
 * response on purpose, like `RemoteModel` is: it is the whole contract with the outside world,
 * and it is what lets this be tested without a network.
 */
export type RemoteTeams = { teams?: readonly { plan?: string }[] }

/**
 * The one call this needs. `GET /teams` has no resource on the SDK client at 2.7.0 — measured,
 * `client.teams` is undefined — so it is reached through the client's own `get`, which keeps the
 * Basic auth, the base URL and the retry policy rather than rebuilding them around a raw fetch.
 */
export type TeamsCatalog = { teams: () => Promise<RemoteTeams> }

/**
 * The one method of the SDK client this needs. Narrower than `Scenario['get']`, whose
 * `APIPromise` carries extras nothing here reads — and which no test can construct.
 */
export type TeamsTransport = { get: (path: string) => Promise<RemoteTeams> }

/** Binds the port to the real SDK, as `catalogOf` does for the model catalogue. */
export function teamsOf(client: TeamsTransport): TeamsCatalog {
  return {
    teams: () => client.get('/teams'),
  }
}

export type PlanReader = {
  /** `null` when the plan cannot be read at all — the studio then greys nothing out. */
  access: () => Promise<PlanAccess | null>
}

export type PlanOptions = {
  catalog: () => TeamsCatalog
  /** Required: a plan belongs to one account, and the cached answer does not say which. */
  watch: WatchCredentials
  ttlMs?: number
  now?: () => number
}

const DEFAULT_TTL_MS = 10 * 60 * 1000

/**
 * The plan behind the current credentials.
 *
 * Cached, because every model row asks the same question and the answer changes when somebody
 * buys a subscription — not between two paints. Ten minutes is the registry's own TTL: an
 * upgrade is honoured within one, and nothing here is worth a round trip per keystroke.
 */
export function createPlanReader({
  catalog,
  watch,
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now,
}: PlanOptions): PlanReader {
  let cached: { at: number; value: PlanAccess | null } | null = null

  watch(() => {
    cached = null
  })

  return {
    access: async () => {
      if (cached && now() - cached.at < ttlMs) return cached.value

      let value: PlanAccess | null = null
      try {
        const { teams } = await catalog().teams()
        const plans = (teams ?? [])
          .map(team => team.plan)
          .filter(name => name !== undefined)
          .map(name => ({ name, level: levelOfPlan(name) }))

        // The strongest of them, on an account holding several: reading the weakest would grey
        // out models one of the teams can run. `-1` ranks an ungradable name below every graded
        // one, so such a name only travels when nothing else did — the panel then shows the plan
        // it could not read rather than denying the account has one.
        const rank = (plan: PlanAccess): number => plan.level ?? -1
        value = plans.reduce<PlanAccess | null>(
          (best, plan) => (best === null || rank(plan) > rank(best) ? plan : best),
          null,
        )
      } catch (error) {
        // Swallowed, not reduced: an unreadable plan must leave the picker exactly as it was
        // before this feature existed. Letting it throw would empty the panel over a nicety.
        // `describeFailure`, never the raw error: an SDK message embeds the request that
        // produced it, so `String(error)` would write the API key into the log file.
        log.warn('provider', `GET /teams refused, nothing greyed out: ${describeFailure(error)}`)
      }

      cached = { at: now(), value }
      return value
    },
  }
}
