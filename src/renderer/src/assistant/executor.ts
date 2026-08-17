import {
  assistantAction,
  commitmentOfCall,
  needsConfirmation,
  validatesInput,
  type ActionName,
  type ActionOutcome,
  type ActionRefusal,
} from '@shared/domain/assistant'
import { getBridge } from '@/services/bridge'
import type { ActionHandlers } from './actionHandler'
import { mountedConfirmer } from './confirm'
import { CORE_HANDLERS } from './coreHandlers'
import { mountedGenerator } from './generatorBridge'

/**
 * One action in, one outcome out — for both doors.
 *
 * The table is assembled here and nowhere else, one entry per name the registry publishes.
 * `executor.test.ts` holds the two lists to each other in both directions: an action published
 * with nothing behind it would answer `badInput` to every client that read `tools/list` and
 * believed it, and a handler nothing publishes is code no caller can reach.
 */
const HANDLERS: ActionHandlers = {
  ...CORE_HANDLERS,
}

const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

/** Every name the table answers, so a test can compare it with the registry. */
export function handledActions(): readonly string[] {
  return Object.keys(HANDLERS)
}

/**
 * Runs one action, its input already agreed to fit the registry.
 *
 * Kept exported and unconfirmed for the store that replays a plan step by step, and for the
 * suite. Everything arriving from outside this window goes through `runConfirmedAction`.
 */
export async function runAction(
  name: ActionName,
  input: Record<string, unknown>,
): Promise<ActionOutcome> {
  const handler = HANDLERS[name]
  // Not reachable through either door — both check the registry first — and answered rather
  // than thrown all the same: the client on the other end waits two minutes for a reply.
  if (!handler) return refused('badInput')

  return handler(input)
}

/**
 * Runs an action, checking its input and asking first when it engages anything.
 *
 * Both gates sit here rather than in the main process, and that is deliberate: the figure quoted
 * comes from the form the window is showing, which the main process cannot see, and the question
 * is asked on a screen only the window has. It also means there is one gate rather than two —
 * whether the call came from the modal or from an MCP client on the other side of the machine,
 * it arrives at this function and is treated the same way.
 */
export async function runConfirmedAction(
  name: ActionName,
  input: Record<string, unknown>,
): Promise<ActionOutcome> {
  /**
   * The one place an input is checked, and the reason handlers may read theirs plainly.
   *
   * Nothing upstream does it: the IPC boundary checks the envelope, the reply parser checks that
   * the action NAME is declared, and the MCP server passes `params.arguments` through untouched
   * — its `additionalProperties: false` is a promise to the client, not an enforcement. What
   * fills these values is a language model, the one caller in the studio that answers something
   * plausible instead of failing.
   */
  const action = assistantAction(name)
  if (!action || !validatesInput(action.fields, input)) return refused('badInput')

  const commitment = commitmentOfCall(name, input)
  if (!needsConfirmation(commitment)) return runAction(name, input)

  const ask = mountedConfirmer()
  // No one to ask. Refusing is the only honest answer: the alternative is spending on a question
  // nobody was shown.
  if (!ask) return refused('noConfirmer')

  // Read BEFORE the question and compared after it — see `unchangedSince`.
  const quoted = commitment === 'credits' ? mountedGenerator()?.body() : null

  const granted = await ask({
    action: name,
    commitment,
    ...(commitment === 'credits' ? { estimate: await estimateOfSubmission() } : {}),
  })

  if (!granted) return refused('declined')

  /**
   * What was priced is what goes out, or nothing does.
   *
   * The question may stand for two minutes — that is what an MCP client is given — and the
   * generator panel stays live behind it. Raising `numImages` from one to ten while "~4 CU" is on
   * screen used to send the ten: the figure was read before the question and the form re-read
   * after the yes, with nothing tying the two together. The yes belongs to a body, not to a
   * moment.
   */
  if (quoted && !unchangedSince(quoted)) return refused('formChanged')

  return runAction(name, input)
}

/** Whether the form still holds exactly what was priced. */
function unchangedSince(quoted: { modelId: string; values: Record<string, unknown> }): boolean {
  const now = mountedGenerator()?.body()
  return (
    now !== undefined &&
    now !== null &&
    now.modelId === quoted.modelId &&
    JSON.stringify(now.values) === JSON.stringify(quoted.values)
  )
}

/**
 * What the prepared form would cost, for the question that is about to be asked.
 *
 * `null` is a legitimate answer and is shown as such: the API declines to price some models, and
 * a figure invented to fill the sentence would be worse than admitting there is none.
 */
async function estimateOfSubmission(): Promise<number | null> {
  const prepared = mountedGenerator()?.body()
  const bridge = getBridge()
  if (!prepared || !bridge) return null

  try {
    const estimate = await bridge.scenario.estimateCost({ id: prepared.modelId }, prepared.values)
    return estimate?.creativeUnits ?? null
  } catch {
    return null
  }
}
