import { levelOfPlan, type PlanAccess } from '@shared/domain/plan'
import { log } from '@main/log'
import { describeFailure } from './client'
import type { WatchCredentials } from './credentials-watch'

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
export type Transport = { get: (path: string) => Promise<RemoteTeams> }

/** Binds the port to the real SDK, as `catalogOf` does for the model catalogue. */
export function teamsOf(client: Transport): TeamsCatalog {
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
        const names = (teams ?? []).map(team => team.plan).filter(name => name !== undefined)

        // The highest of them, on an account holding several: reading the weakest would grey out
        // models one of the teams can run. `levelOfPlan` makes the same choice for the same reason.
        for (const name of names) {
          const level = levelOfPlan(name)

          // An ungradable name still travels, with a null level, so the panel can show the plan
          // it could not read rather than claim the account has none — but it never outranks a
          // graded one, since a level is what deciding anything takes.
          if (level === null) value ??= { name, level }
          else if (value === null || value.level === null || level > value.level) {
            value = { name, level }
          }
        }
      } catch (error) {
        // Swallowed, not reduced: an unreadable plan must leave the picker exactly as it was
        // before this feature existed. Letting it throw would empty the panel over a nicety.
        // `describeFailure`, never the raw error: an SDK message embeds the request that
        // produced it, so `String(error)` would write the API key into the log file.
        log.warn('scenario', `GET /teams refused, nothing greyed out: ${describeFailure(error)}`)
      }

      cached = { at: now(), value }
      return value
    },
  }
}
