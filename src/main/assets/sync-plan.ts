/**
 * Deciding what would move, without moving anything.
 *
 * Pure on purpose, and separate from the runner that carries a plan out. Two reasons: a plan can
 * be shown to the user before it costs a single request — "12 to push, 3 to fetch" — and the
 * whole promise that two-way sync is a later *policy* rather than a rewrite rests on this one
 * function being the only place that decides.
 *
 * The studio only ever asks for `push` or `pull` today, both from an explicit selection. The
 * `two-way` policy is written and tested all the same: it is the comparison the three stamps
 * were recorded for, and leaving it out until it is needed is how it ends up being bolted on.
 */

export type SyncPolicy = 'push' | 'pull' | 'two-way'

/** What the planner needs to know about one asset. A row of the catalogue, narrowed. */
export type SyncSide = {
  assetId: string
  /** Whether the project actually holds the bytes. A cloud-only row does not. */
  hasLocalFile: boolean
  remoteAssetId?: string
  /** The project the twin lives in — an API key opens onto exactly one. */
  remoteOwnerId?: string
  remoteUpdatedAt?: string
  /** When the two sides were last reconciled. The baseline both other stamps are read against. */
  remoteSyncedAt?: string
  localChangedAt?: string
}

export type SkipReason =
  /** The twin belongs to a project this key does not open onto. */
  | 'other-account'
  /** Nothing to send: there are no bytes here. */
  | 'no-local-file'
  /** Nothing to fetch: this asset has no twin. */
  | 'no-twin'
  | 'nothing-to-do'

export type SyncAction =
  | { kind: 'push'; assetId: string }
  | { kind: 'pull'; assetId: string; remoteAssetId: string }
  /** Both sides moved since they last agreed. Never resolved here — only reported. */
  | { kind: 'conflict'; assetId: string; remoteAssetId: string }
  | { kind: 'skip'; assetId: string; reason: SkipReason }

export type SyncPlan = {
  actions: SyncAction[]
  summary: Record<SyncAction['kind'], number>
}

/**
 * Whether a stamp is later than the baseline.
 *
 * Parsed rather than compared as text: both stamps are ISO today, but one comes from the API and
 * one from us, and a string comparison would quietly give the wrong answer the day one of them
 * carries an offset instead of a Z. An unreadable stamp counts as "not moved" — refusing to act
 * on a date nobody can read beats pushing over a file on the strength of it.
 */
function movedSince(stamp: string | undefined, baseline: string | undefined): boolean {
  if (stamp === undefined) return false
  if (baseline === undefined) return true

  const at = Date.parse(stamp)
  const since = Date.parse(baseline)
  return Number.isNaN(at) || Number.isNaN(since) ? false : at > since
}

function actionFor(side: SyncSide, policy: SyncPolicy, activeOwnerId: string | null): SyncAction {
  const { assetId, remoteAssetId } = side

  // A twin under another project is not out of date, it is out of reach: the identifier means
  // nothing under this key, and pushing would upload a second copy into the wrong library.
  if (
    remoteAssetId !== undefined &&
    activeOwnerId !== null &&
    side.remoteOwnerId !== undefined &&
    side.remoteOwnerId !== activeOwnerId
  ) {
    return { kind: 'skip', assetId, reason: 'other-account' }
  }

  const localMoved = movedSince(side.localChangedAt, side.remoteSyncedAt)
  const remoteMoved = movedSince(side.remoteUpdatedAt, side.remoteSyncedAt)

  if (policy === 'push') {
    if (!side.hasLocalFile) return { kind: 'skip', assetId, reason: 'no-local-file' }
    if (remoteAssetId === undefined || localMoved) return { kind: 'push', assetId }
    return { kind: 'skip', assetId, reason: 'nothing-to-do' }
  }

  if (policy === 'pull') {
    if (remoteAssetId === undefined) return { kind: 'skip', assetId, reason: 'no-twin' }
    if (!side.hasLocalFile || remoteMoved) return { kind: 'pull', assetId, remoteAssetId }
    return { kind: 'skip', assetId, reason: 'nothing-to-do' }
  }

  if (remoteAssetId === undefined) {
    return side.hasLocalFile
      ? { kind: 'push', assetId }
      : { kind: 'skip', assetId, reason: 'no-local-file' }
  }

  if (!side.hasLocalFile) return { kind: 'pull', assetId, remoteAssetId }
  if (localMoved && remoteMoved) return { kind: 'conflict', assetId, remoteAssetId }
  if (localMoved) return { kind: 'push', assetId }
  if (remoteMoved) return { kind: 'pull', assetId, remoteAssetId }
  return { kind: 'skip', assetId, reason: 'nothing-to-do' }
}

/**
 * What each asset would do under this policy, and a count per outcome for the confirmation the
 * user sees. Skips are kept rather than filtered out: "nothing happened" is an answer, and one
 * the dialog has to be able to explain.
 */
export function planSync(
  sides: readonly SyncSide[],
  policy: SyncPolicy,
  activeOwnerId: string | null,
): SyncPlan {
  const actions = sides.map(side => actionFor(side, policy, activeOwnerId))
  const summary = { push: 0, pull: 0, conflict: 0, skip: 0 }
  for (const action of actions) summary[action.kind] += 1

  return { actions, summary }
}
