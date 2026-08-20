import {
  assistantAction,
  commitmentOfCall,
  needsConfirmation,
  refused,
  validatesInput,
  type ActionName,
  type ActionOutcome,
} from '@shared/domain/assistant'
import { delegated } from '@shared/domain/delegation'
import { getBridge } from '@/services/bridge'
import { useSettings } from '@/stores/settings'
import type { ActionHandlers } from './actionHandler'
import { mountedConfirmer } from './confirm'
import { ASSET_HANDLERS } from './assetHandlers'
import { CANVAS_HANDLERS } from './canvasHandlers'
import { CLOUD_HANDLERS } from './cloudHandlers'
import { CORE_HANDLERS } from './coreHandlers'
import { FILE_HANDLERS } from './fileHandlers'
import { mountedGenerator } from './generatorBridge'
import { GIT_HANDLERS } from './gitHandlers'
import { JOB_HANDLERS } from './jobHandlers'
import { MATERIAL_HANDLERS } from './materialHandlers'
import { RIG_HANDLERS } from './rigHandlers'
import { SCENE_HANDLERS } from './sceneHandlers'
import { SEQUENCE_HANDLERS } from './sequenceHandlers'
import { SETTINGS_HANDLERS } from './settingsHandlers'
import { SHELL_HANDLERS } from './shellHandlers'
import { STATE_HANDLERS } from './stateHandlers'

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
  ...STATE_HANDLERS,
  ...FILE_HANDLERS,
  ...JOB_HANDLERS,
  ...ASSET_HANDLERS,
  ...CLOUD_HANDLERS,
  ...CANVAS_HANDLERS,
  ...SEQUENCE_HANDLERS,
  ...MATERIAL_HANDLERS,
  ...SCENE_HANDLERS,
  ...RIG_HANDLERS,
  ...GIT_HANDLERS,
  ...SETTINGS_HANDLERS,
  ...SHELL_HANDLERS,
}

/** Every name the table answers, so a test can compare it with the registry. */
export function handledActions(): readonly string[] {
  return Object.keys(HANDLERS)
}

/**
 * What this window has already spent WITHOUT asking, against the delegated budget.
 *
 * Its blind spot, written rather than hidden: the ledger is per WINDOW and per launch. Two windows
 * open at once each carry the whole budget, so an armed studio with two windows may spend twice
 * what was armed. It is here rather than in the main process because the figure it counts — the
 * estimate — is read off the form only a window can see, and moving the count without moving the
 * quote would put the two out of step.
 */
let spentUnasked = 0

/** For the suite, which must not have one case's spending decide the next one's. */
export function resetDelegatedSpendForTests(): void {
  spentUnasked = 0
}

/**
 * Runs one action, having checked its input against the fields that declare it.
 *
 * The check lives HERE rather than one level up, and that is what lets every handler read its
 * input plainly: `runAction` is exported, so a gate on the confirmed path alone would be a gate
 * with a way around it. Nothing else does the work either — the IPC boundary checks the
 * envelope, the reply parser checks the NAME, and the MCP server passes `params.arguments`
 * through untouched, its `additionalProperties: false` being a promise to the client rather than
 * an enforcement.
 */
export async function runAction(
  name: ActionName,
  input: Record<string, unknown>,
): Promise<ActionOutcome> {
  const action = assistantAction(name)
  const handler = HANDLERS[name]
  if (!action || !handler || !validatesInput(action.fields, input)) return refused('badInput')

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
  // Checked before the question as well as inside `runAction`: a bad input asked about first
  // would have the person approve a spend that was never going to happen.
  const action = assistantAction(name)
  if (!action || !validatesInput(action.fields, input)) return refused('badInput')

  const commitment = commitmentOfCall(name, input)
  if (!needsConfirmation(commitment)) return runAction(name, input)

  // Read once, before the question and before the delegation is consulted: both read the same
  // figure, and a form moved between the two would price one thing and send another.
  const estimate = commitment === 'credits' ? await estimateOfSubmission() : null

  if (delegated(useSettings.getState().settings.mcp, commitment, estimate, spentUnasked)) {
    // Debited BEFORE the run and never given back: an action that failed halfway may already have
    // spent, and a ledger that only counted successes would let a run of failures spend forever.
    if (estimate !== null) spentUnasked += estimate
    return runAction(name, input)
  }

  const ask = mountedConfirmer()
  // No one to ask. Refusing is the only honest answer: the alternative is spending on a question
  // nobody was shown.
  if (!ask) return refused('noConfirmer')

  // Read BEFORE the question and compared after it — see `unchangedSince`.
  const quoted = commitment === 'credits' ? mountedGenerator()?.body() : null

  const granted = await ask({
    action: name,
    commitment,
    ...(commitment === 'credits' ? { estimate } : {}),
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
