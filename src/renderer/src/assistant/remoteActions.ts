import { assistantAction } from '@shared/domain/assistant'
import type { ActionOutcome } from '@shared/domain/assistant'
import { getBridge } from '@/services/bridge'

/**
 * Actions asked for from OUTSIDE this window — today, by an MCP client.
 *
 * They land on exactly the same gate as the ones the conversation decides on: `runConfirmedAction`.
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

  /**
   * 🛑 Here and not only in `mcpTools()`: a client may CALL a name it never saw listed, and
   * `studio.batch` carries one too. Listed-only, the question was drawn on this screen, the
   * client was told `timedOut` after two seconds, and the click was dropped in silence.
   */
  if (known.reach === 'window') return { ok: false, refusal: 'notAllowed' }

  try {
    /**
     * Loaded on the call rather than at launch, and this is the one edge that decides it: the
     * handler table reaches all fourteen families — the canvas, the scene, the rig, git — some
     * thirty modules the opening chunk has no use for, on a door that is off by default.
     */
    const { runConfirmedAction } = await import('./executor')
    return await runConfirmedAction(known.name, input)
  } catch {
    // Nothing may leave this window unanswered: the client on the other end waits two minutes
    // for a reply it would otherwise never get. `failed` rather than `badInput`, which named a
    // full disk, a refused path and a dropped connection as the caller's own parameters.
    return { ok: false, refusal: 'failed' }
  }
}
