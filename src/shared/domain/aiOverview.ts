import type { AiRoleId, RoleProvider } from './aiRole'
import type { Compatibility } from './aiMemory'
import type { DownloadProgress, LocalModel } from './localModel'
import type { FitObstacle } from './modelFit'

/**
 * What the manager screen reads — one row per ROLE, never one per model.
 *
 * The verdict travels with each candidate rather than being recomputed in the window: the main
 * process is the one holding the memory reading, and two sides deciding on their own would
 * disagree the moment a job starts.
 */

/** Where a choice came from, which is what tells "inherited" from "set here". */
export type ChoiceScope = 'app' | 'project'

/** The values beside the type: the scope selector composes a key per member, and a guard reads it. */
export const CHOICE_SCOPES: readonly ChoiceScope[] = ['app', 'project']

export type ModelCandidate = {
  readonly model: LocalModel
  readonly installed: boolean
  /** Whether the weights are resident in memory right now — what "activate" means, ADR-21 § D. */
  readonly loaded: boolean
  /** Rank 3: the person's own file, so nothing vouches for its licence. A mark, never a lock. */
  readonly unverified: boolean
  /** Whether removing it drops the ENTRY rather than the weights — see `isSuppliedModel`. */
  readonly supplied: boolean
  /**
   * Whether its runtime can hold it in memory at all. `false` for one that opens its weights per
   * call — offering "Load" there produced a memory sentence about a gesture that does not exist.
   */
  readonly holdable: boolean
  /**
   * How many employments this ONE download answers for.
   *
   * Shown because the catalogue holds twenty-five models for nineteen employments, and the
   * difference between them is not the quality: SSD-1B serves six for 4.47 GB where Mochi serves
   * one for 133. Nothing here ranks them — the figure is said, and the choice stays the person's.
   */
  readonly serves: number
  /** `insufficient-memory` and `incompatible` are shown, greyed, WITH their reason — never hidden. */
  readonly fit: Compatibility
  /** What the reason NAMES. Carried rather than recomputed: the machine decides, the window says. */
  readonly obstacle: FitObstacle | null
}

export type RoleRow = {
  readonly role: AiRoleId
  /** What serves it right now, choice or default. `null` when nothing can. */
  readonly provider: RoleProvider | null
  /**
   * What EACH scope holds, `null` where nothing was chosen — never what serves.
   *
   * Both, because a screen edits one scope while the summary shows the effect of both: reading
   * the effect back into the controls left a click writing a scope that already agreed, doing
   * nothing and saying nothing.
   */
  readonly chosen: Readonly<Record<ChoiceScope, RoleProvider | null>>
  readonly candidates: readonly ModelCandidate[]
  /**
   * The clouds offered for this role — those that serve it AND have an account behind them.
   * Empty is an ordinary answer: dictation is served on this machine or not at all.
   */
  readonly clouds: readonly string[]
}

/** What the machine offers, as the screen states it above the rows. */
export type MachineSummary = {
  readonly physicalBytes: number
  readonly availableBytes: number
  readonly diskFreeBytes: number | null
  /** `ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, …)`, or nothing on a machine that hid it. */
  readonly gpu: string | null
  /**
   * What the GPU holds, ANSWERED by a runtime rather than deduced — `null` where none did.
   *
   * On a `unified` machine it is the same pot as the system memory; on a `split` one it is the
   * only figure that decides whether weights fit, and the reason a RAM-only reading was wrong in
   * both directions.
   */
  readonly vram: { readonly totalBytes: number; readonly freeBytes: number } | null
}

/**
 * Why a load did not happen, kept until the next gesture so the screen can say it.
 *
 * 🛑 Discriminated, and that is what stops a figure from being invented: only the admission
 * weighed bytes, so only its branch carries them. A runtime that refused for its own reasons
 * used to borrow the last published reading and say "8 GB asked for" about a broken addon.
 */
export type LoadRefusal =
  | {
      readonly reason: 'beyond-machine'
      readonly modelId: string
      readonly neededBytes: number
      readonly availableBytes: number
    }
  | { readonly reason: 'failed'; readonly modelId: string }

export type AiOverview = {
  readonly roles: readonly RoleRow[]
  readonly machine: MachineSummary
  /** Which project the project-scoped column applies to. `null` when none is open. */
  readonly projectPath: string | null
  /** At most one install runs at a time: a second would compete for the same disk and bar. */
  readonly installing: { readonly modelId: string; readonly progress: DownloadProgress } | null
  /** The load in flight and how far it is, from 0 to 1. One at a time, like the install. */
  readonly loading: { readonly modelId: string; readonly ratio: number } | null
  /** What the last load refused, or nothing. Cleared by the next load, never by a compose. */
  readonly loadFailure: LoadRefusal | null
}
