/**
 * What the account's plan is allowed to run.
 *
 * The API grades every model with `accessRestrictions` and refuses a generation whose model
 * outranks the caller's plan — HTTP 403, `ModelAccessRestrictedError`. Honoured in the interface
 * rather than discovered as a 403, the same choice a locked workflow makes in `workflow.ts`:
 * measured on a `cu-basic` account, 41 of the 100 first public models are out of reach, so the
 * refusal is the common case rather than the edge one.
 */

/** The account's plan, as `GET /teams` spells it, and what it is worth on the model scale. */
export type PlanAccess = {
  /** The identifier the API answers — `cu-basic`, `cu-pro-q3-25`. */
  name: string
  /**
   * `null` when nothing in `name` is recognised. Nothing is greyed out then: a plan whose worth
   * cannot be read must not cost a user the models they are paying for.
   */
  level: number | null
}

/**
 * The scale, read by segment rather than matched whole.
 *
 * Plan names carry the quarter they were priced in — `cu-pro-q3-25` — so matching the whole
 * string would make next quarter's name unreadable, and grey out nothing for everyone on it.
 *
 * MEASURED on a `cu-basic` account: models graded 0, 1 and 25 are accepted, one graded 50 is
 * refused naming `requiredPlan: cu-pro-q3-25`. That fixes `basic` at 25 and `pro` at 50. The
 * other three are the SDK's own documentation of `accessRestrictions`, which is the only source
 * for them — no account here holds those plans, so nothing here measured them.
 */
const PLAN_LEVELS: readonly { segment: string; level: number }[] = [
  { segment: 'free', level: 0 },
  { segment: 'basic', level: 25 },
  { segment: 'creator', level: 25 },
  { segment: 'pro', level: 50 },
  { segment: 'team', level: 75 },
  { segment: 'enterprise', level: 100 },
]

/** What a plan name is worth, or `null` when no segment of it is known. */
export function levelOfPlan(name: string): number | null {
  const segments = name.toLowerCase().split('-')
  const matched = PLAN_LEVELS.filter(entry => segments.includes(entry.segment))

  // The highest match, not the first: under-reading a plan greys out models the user is paying
  // for, which is the one failure worth avoiding here. Over-reading only lets the 403 through.
  return matched.length > 0 ? Math.max(...matched.map(entry => entry.level)) : null
}

/**
 * Whether a model asks for more than the plan holds.
 *
 * False whenever either side is unknown — an unread plan, an ungraded model. A row is greyed out
 * only when the studio can say why, because being wrong hides a model that would have run.
 */
export function isBeyondPlan(
  requiredLevel: number | undefined,
  access: PlanAccess | null,
): boolean {
  if (requiredLevel === undefined || access === null || access.level === null) return false
  return requiredLevel > access.level
}
