import { refused, type ActionName, type ActionOutcome } from '@shared/domain/assistant'
import type { StudioBridge } from '@shared/ipc'
import { getBridge } from '@/services/bridge'

/**
 * What one action does, once `validatesInput` has agreed its input fits the registry.
 *
 * A handler may therefore read its input plainly. What it may not assume is meaning: an id that
 * parses is still an id of something that may be gone, which is why every handler answers a
 * refusal rather than throwing.
 */
export type ActionHandler = (
  input: Record<string, unknown>,
) => ActionOutcome | Promise<ActionOutcome>

/**
 * One family's share of the table, assembled in `executor.ts`. `executor.test.ts` holds the whole
 * to the registry in both directions — an action published with nothing behind it would answer
 * `badInput` to every client that read `tools/list` and believed it.
 */
export type ActionHandlers = Partial<Record<ActionName, ActionHandler>>

/**
 * Runs against the bridge, or refuses for the one reason a window can have none.
 *
 * The guard was written out at twenty-two call sites before this existed, which is twenty-two
 * chances to answer `ok` on a call that never left the window.
 */
export async function withBridge(
  run: (bridge: StudioBridge) => Promise<unknown>,
): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge')

  return { ok: true, data: await run(bridge) }
}
