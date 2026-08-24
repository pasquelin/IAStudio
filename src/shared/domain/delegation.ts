import type { ActionCommitment } from './assistantAction'
import type { Settings } from './settings'

/**
 * Whether an action may run without the question on screen.
 *
 * The one piece of the delegation that decides anything, and it is pure: what it answers has to be
 * checkable without a window, because what it answers is whether a machine may spend somebody's
 * money while they are not looking.
 *
 * Three rules, and none of them is a convenience:
 *
 * - Nothing is delegated unless the person armed it. Every field defaults to off or to zero.
 * - A spend the API declined to PRICE is never delegated, whatever the budget holds. An unknown
 *   cost is an unbounded one, and a ceiling cannot bound it.
 * - The budget is what is left, not what was set: it is measured against what this window has
 *   already spent unasked, so ten calls of one unit each are ten units and not one.
 */
export type Delegation = Settings['mcp']

export function delegated(
  mcp: Delegation,
  commitment: ActionCommitment,
  estimate: number | null,
  spent: number,
): boolean {
  switch (commitment) {
    // Never reaches here — `needsConfirmation` is false for it — and answered anyway rather than
    // left to a default that would one day catch something else.
    case 'none':
      return true
    case 'files':
      return mcp.delegateFiles
    case 'asset':
      return mcp.delegateAsset
    case 'remote':
      return mcp.delegateRemote
    // No switch arms this one, deliberately: what it changes is which account answers and which
    // project is open, and a checkbox that waves those through is a checkbox nobody should have.
    case 'studio':
      return false
    case 'credits':
      return estimate !== null && spent + estimate <= mcp.delegateBudget
  }
}
