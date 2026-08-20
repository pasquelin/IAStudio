import {
  canMoveWorkspace,
  movedWorkspaceBy,
  workspaceOrder,
  type WorkspaceId,
  type WorkspaceMove,
} from '@shared/domain/workspace'
import { useSettings } from '@/stores/settings'

/**
 * Moves a space one place along the bar and writes the new order, or `null` at the end of it. The
 * three ways of asking for a STEP share it — the keyboard, the pill's menu, a command — and are
 * handed the new order for the announcement they may want to make; nothing here speaks.
 */
export function applyWorkspaceMove(
  id: WorkspaceId,
  move: WorkspaceMove,
): readonly WorkspaceId[] | null {
  const order = workspaceOrder(useSettings.getState().settings.workspaces.order)
  if (!canMoveWorkspace(order, id, move)) return null

  const next = movedWorkspaceBy(order, id, move)
  void useSettings.getState().write({ workspaces: { order: [...next] } })
  return next
}
