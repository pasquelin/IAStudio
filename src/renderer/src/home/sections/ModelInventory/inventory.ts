import type { AiOverview, RoleRow } from '@shared/domain/aiOverview'
import { CLOUD_IDS, type CloudProviderId } from '@shared/domain/aiCloud'
import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import { fitAllowsUse } from '@shared/domain/modelFit'
import { MODEL_FAMILIES, type ModelFamily } from '@shared/domain/model'

/** What the band's two halves both need, and neither owns. */
export type Translate = (key: string, values?: Record<string, string | number>) => string

export type LocalStanding = {
  installed: number
  /** What those installed weigh, added once each. */
  installedBytes: number
  /** Resident in memory right now, which is what "activate" means — ADR-21 § D. */
  loaded: number
  /** Not installed, and this machine could hold them. */
  offered: number
  /** Not installed, and it could not run them. Counted so the band can say so rather than hide it. */
  outOfReach: number
}

/**
 * What the machine holds, counted over DISTINCT models.
 *
 * 🛑 The overview is keyed by EMPLOYMENT and one download answers up to six of them, so a flat
 * walk of the candidate lists counts SSD-1B six times and its 4.47 GB with it.
 */
export function localStandingOf(overview: AiOverview): LocalStanding {
  const seen = new Map<
    string,
    { installed: boolean; loaded: boolean; usable: boolean; bytes: number }
  >()

  for (const row of overview.roles) {
    for (const one of row.candidates) {
      seen.set(one.model.id, {
        installed: one.installed,
        loaded: one.loaded,
        usable: fitAllowsUse(one.fit),
        bytes: one.model.diskBytes,
      })
    }
  }

  const standing: LocalStanding = {
    installed: 0,
    installedBytes: 0,
    loaded: 0,
    offered: 0,
    outOfReach: 0,
  }

  for (const model of seen.values()) {
    if (!model.installed) {
      if (model.usable) standing.offered += 1
      else standing.outOfReach += 1
      continue
    }

    standing.installed += 1
    standing.installedBytes += model.bytes
    if (model.loaded) standing.loaded += 1
  }

  return standing
}

/**
 * The clouds with an account behind them, in the registry's order. Read off the rows, where
 * `clouds` already means "serves this role AND has a key" — asking a second way is how two
 * answers drift.
 */
export function cloudIdsOf(overview: AiOverview): readonly CloudProviderId[] {
  const held = new Set(overview.roles.flatMap(row => row.clouds))

  return CLOUD_IDS.filter(id => held.has(id))
}

/** One line of the employment list: a whole family, or one of the roles no family holds. */
export type EmploymentGroup = {
  /** React key. The label comes from whichever of `family` and `role` is set. */
  key: string
  served: number
  total: number
  /**
   * The row itself where the group holds exactly ONE employment — that is where naming what
   * serves it says more than a tally. Always set on a standalone role, which is a group of one.
   */
  sole: RoleRow | null
} & ({ family: ModelFamily; role: null } | { family: null; role: AiRoleId })

/** Whether an employment has something answering for it today — a choice, never a fill-in. */
function servedBy(row: RoleRow): boolean {
  return row.provider !== null
}

/**
 * The list, families first in the registry's order and the standalone roles after them.
 *
 * The denominator is what the OVERVIEW offers rather than every employment the studio names: the
 * main process drops the roles nothing could serve, and counting those in would tell someone with
 * a full machine that they are two thirds of the way there.
 */
export function employmentGroupsOf(overview: AiOverview): readonly EmploymentGroup[] {
  const byFamily = new Map<ModelFamily, RoleRow[]>()
  const standalone: RoleRow[] = []

  for (const row of overview.roles) {
    const family = partsOfRole(row.role)?.family
    if (family === undefined) {
      standalone.push(row)
      continue
    }

    const held = byFamily.get(family) ?? []
    held.push(row)
    byFamily.set(family, held)
  }

  const families = MODEL_FAMILIES.flatMap(family => {
    const rows = byFamily.get(family)
    if (rows === undefined) return []

    return [
      {
        key: family,
        family,
        role: null,
        served: rows.filter(servedBy).length,
        total: rows.length,
        sole: rows.length === 1 ? (rows[0] ?? null) : null,
      },
    ]
  })

  return [
    ...families,
    ...standalone.map(row => ({
      key: row.role,
      family: null,
      role: row.role,
      served: servedBy(row) ? 1 : 0,
      total: 1,
      sole: row,
    })),
  ]
}
