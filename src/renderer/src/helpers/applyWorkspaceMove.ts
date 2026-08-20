import {
  canMoveWorkspace,
  movedWorkspaceBy,
  workspaceOrder,
  type WorkspaceId,
  type WorkspaceMove,
} from '@shared/domain/workspace'
import { useSettings } from '@/stores/settings'

/**
 * Moves a space one place along the bar and writes the new order, or answers `null` when it is
 * already at the end.
 *
 * The four ways of asking share it — the drag, the keyboard, the pill's menu and a command — so
 * that the refusal and the write are decided once. The caller is handed the new order for the
 * announcement it may want to make; nothing here speaks.
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
