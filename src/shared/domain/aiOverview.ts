import type { AiRoleId, RoleProvider } from './aiRole'
import type { Compatibility } from './aiMemory'
import type { DownloadProgress, LocalModel } from './localModel'

/**
 * What the manager screen reads — one row per ROLE, never one per model.
 *
 * The verdict travels with each candidate rather than being recomputed in the window: the main
 * process is the one holding the memory reading, and two sides deciding on their own would
 * disagree the moment a job starts.
 */

/** Where a choice came from, which is what tells "inherited" from "set here". */
export type ChoiceScope = 'app' | 'project'

export type ModelCandidate = {
  readonly model: LocalModel
  readonly installed: boolean
  /** `insufficient-memory` and `incompatible` are shown, greyed, WITH their reason — never hidden. */
  readonly fit: Compatibility
}

export type RoleRow = {
  readonly role: AiRoleId
  /** What serves it right now, choice or default. `null` when nothing can. */
  readonly provider: RoleProvider | null
  /** Where the choice was written, or `null` when nothing was chosen and the default stands. */
  readonly chosenAt: ChoiceScope | null
  readonly candidates: readonly ModelCandidate[]
  /** Whether an account could serve this role, which decides if Scenario is offered at all. */
  readonly scenarioReady: boolean
}

/** What the machine offers, as the screen states it above the rows. */
export type MachineSummary = {
  readonly physicalBytes: number
  readonly availableBytes: number
  readonly diskFreeBytes: number | null
  /** `ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, …)`, or nothing on a machine that hid it. */
  readonly gpu: string | null
}

export type AiOverview = {
  readonly roles: readonly RoleRow[]
  readonly machine: MachineSummary
  /** Which project the project-scoped column applies to. `null` when none is open. */
  readonly projectPath: string | null
  /** At most one install runs at a time: a second would compete for the same disk and bar. */
  readonly installing: { readonly modelId: string; readonly progress: DownloadProgress } | null
}
