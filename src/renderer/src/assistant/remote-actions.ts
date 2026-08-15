import { assistantAction } from '@shared/domain/assistant'
import type { ActionOutcome } from '@shared/domain/assistant'
import { getBridge } from '@/services/bridge'
import { runConfirmedAction } from './executor'

/**
 * Actions asked for from OUTSIDE this window — today, by an MCP client.
 *
 * They land on exactly the same gate as the ones the modal decides on: `runConfirmedAction`.
 * That is the whole point of the arrangement — a generation asked for from the other side of
 * the machine raises the same question on this screen, with the same figure, and spends nothing
 * until somebody says yes.
 *
 * Every window subscribes; only the one in front is ever sent anything.
 */
export function connectRemoteActions(): () => void {
  const bridge = getBridge()
  if (!bridge) return () => {}

  return bridge.assistant.onAction(({ callId, call }) => {
    void answer(callId, call.action, call.input)
  })
}

async function answer(
  callId: string,
  action: string,
  input: Record<string, unknown>,
): Promise<void> {
  const outcome = await runFor(action, input)
  await getBridge()?.assistant.actionResult({ callId, outcome })
}

async function runFor(action: string, input: Record<string, unknown>): Promise<ActionOutcome> {
  // Checked here rather than trusted: the main process reads the same registry, but the name
  // still crossed a boundary, and `runConfirmedAction` takes an `ActionName` the compiler can
  // no longer vouch for on this side.
  const known = assistantAction(action)
  if (!known) return { ok: false, refusal: 'badInput' }

  try {
    return await runConfirmedAction(known.name, input)
  } catch {
    // Nothing may leave this window unanswered: the client on the other end waits two minutes
    // for a reply it would otherwise never get.
    return { ok: false, refusal: 'badInput' }
  }
}
