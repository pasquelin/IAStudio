import {
  type ActionName,
  type ActionOutcome,
  type ActionRefusal,
  commitmentOfCall,
  needsConfirmation,
} from '@shared/domain/assistant'
import { commandDescriptor, scopeOfWorkspace } from '@shared/domain/command'
import { MODEL_FAMILIES } from '@shared/domain/model'
import { WORKSPACE_IDS, type WorkspaceId } from '@shared/domain/workspace'
import { isRecord } from '@shared/guards'
import { showWorkspace } from '@/app/dockviewApi'
import { createDocumentIn } from '@/app/newDocument'
import { openGeneratorOn } from '@/helpers/openGenerator'
import { revealTool } from '@/helpers/revealPanel'
import { getBridge } from '@/services/bridge'
import { publishCommand } from '@/services/commandBus'
import { runGlobalCommand } from '@/services/globalCommands'
import { useJobs } from '@/stores/jobs'
import { toolSurface } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { mountedConfirmer } from './confirm'
import { mountedGenerator } from './generator-bridge'

const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

/**
 * The inputs are read rather than asserted, and these guards are the ONLY thing checking them.
 *
 * Said plainly because the opposite was written here first: nothing upstream validates a call
 * against `action.fields`. The IPC boundary checks the envelope (`main/assistant/validation.ts`),
 * the reply parser checks that the action NAME is declared (`main/assistant/reply.ts`), and the
 * MCP server passes `params.arguments` through untouched — its `additionalProperties: false` is
 * a promise to the client, not an enforcement.
 *
 * Which makes these four lines the guard rather than belt and braces: what fills these values is
 * a language model, the one caller in the studio that answers something plausible instead of
 * failing, and a wrong `workspace` would otherwise reach `showWorkspace` as a string it has no
 * panel for. Deriving a validator from `action.fields` would serve all three callers at once and
 * is the right shape; it is not this batch.
 */
function textOf(input: Record<string, unknown>, key: string): string | null {
  const value = input[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function oneOf<T extends string>(
  input: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | null {
  const value = input[key]
  return allowed.find(candidate => candidate === value) ?? null
}

/**
 * Fires a command at the surface listening for it, having first checked one is.
 *
 * `publishCommand` is memoryless and filtered by scope on the subscriber's side: a command sent
 * while no document of that scope is mounted and active is dropped in silence. That is right for
 * a menu, whose rows grey out, and wrong here — the assistant would report having done something
 * that never happened. So the scope is checked first, and a mismatch is said out loud.
 */
function runCommand(input: Record<string, unknown>): ActionOutcome {
  const id = textOf(input, 'command')
  const descriptor = id === null ? null : commandDescriptor(id)
  if (!descriptor) return refused('unknownCommand')

  // `global` commands never travel the bus: they are run here, through the same module the
  // native menu goes through. The three the main process performs on its own answer `false`,
  // and those are the only ones this still turns away.
  if (descriptor.scope === 'global') {
    return runGlobalCommand(descriptor.id) ? { ok: true } : refused('globalCommand')
  }

  if (scopeOfWorkspace(toolSurface()) !== descriptor.scope) return refused('wrongSurface')

  publishCommand(descriptor.id)
  return { ok: true }
}

async function submitPrepared(): Promise<ActionOutcome> {
  const generator = mountedGenerator()
  if (!generator) {
    // Opened rather than merely refused: the next attempt then has somewhere to land, and the
    // panel is what the person needs to see anyway to judge what is about to be sent.
    revealTool('generator')
    return refused('generatorClosed')
  }

  if (!generator.body()) return refused('nothingPrepared')

  const job = await generator.submit()
  return job ? { ok: true, data: { jobId: job.id } } : refused('notSubmitted')
}

async function searchModels(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge')

  const query = textOf(input, 'query')
  if (query === null) return refused('badInput')

  const family = oneOf(input, 'family', MODEL_FAMILIES)
  const page = await bridge.scenario.searchModels({ search: query, ...(family ? { family } : {}) })

  return {
    ok: true,
    data: page.items.map(model => ({ id: model.id, name: model.name, family: model.family })),
  }
}

function prepareGenerator(input: Record<string, unknown>): ActionOutcome {
  const family = oneOf(input, 'family', MODEL_FAMILIES)
  const modelId = textOf(input, 'modelId')
  const parameters = input.parameters

  if (!family || modelId === null || !isRecord(parameters)) {
    return refused('badInput')
  }

  openGeneratorOn(family, modelId, parameters)
  return { ok: true }
}

function selectModel(input: Record<string, unknown>): ActionOutcome {
  const family = oneOf(input, 'family', MODEL_FAMILIES)
  const modelId = textOf(input, 'modelId')
  if (!family || modelId === null) return refused('badInput')

  useModels.getState().select(family, modelId)
  return { ok: true }
}

function openWorkspace(input: Record<string, unknown>): ActionOutcome {
  const workspace: WorkspaceId | null = oneOf(input, 'workspace', WORKSPACE_IDS)
  if (!workspace) return refused('badInput')

  if (input.createDocument === true) createDocumentIn(workspace)
  else showWorkspace(workspace)
  return { ok: true }
}

/**
 * Runs one action and says what happened.
 *
 * Every branch calls the helper the studio already uses for that gesture — the rail's own way of
 * making a document, the inspector's own way of opening the generator. Nothing here is a second
 * path to an existing behaviour, which is what keeps the assistant from drifting away from what
 * the buttons do.
 */
export async function runAction(
  name: ActionName,
  input: Record<string, unknown>,
): Promise<ActionOutcome> {
  switch (name) {
    case 'command.run':
      return runCommand(input)
    case 'workspace.open':
      return openWorkspace(input)
    case 'models.search':
      return searchModels(input)
    case 'models.select':
      return selectModel(input)
    case 'generator.prepare':
      return prepareGenerator(input)
    case 'generator.submit':
      return submitPrepared()
    case 'jobs.list':
      return {
        ok: true,
        data: useJobs.getState().jobs.map(job => ({
          id: job.id,
          label: job.label,
          status: job.status,
          progress: job.progress,
        })),
      }
    /**
     * Recognised here, carried out by the conversation itself — see `say` in `stores/assistant`.
     *
     * Not `useAssistant.getState().hide()` on this line, tempting as it is: that store imports
     * this file to run a plan, and reaching back into it would close the loop between the two.
     * The window belongs to the conversation, not to the executor of studio actions.
     */
    case 'chat.close':
      return { ok: true }
    case 'prompt.suggest':
      return suggestPrompts(input)
    case 'prompt.translate':
      return translatePrompt(input)
    case 'prompt.describeStyle':
      return describeStyle()
  }
}

/**
 * The three the prompt field used to carry as buttons.
 *
 * The channels behind them are untouched — the whole of what changed is who presses. Each
 * answers in one round trip and spends nothing, which is what made them buttons and what makes
 * them free to ask for.
 */
async function suggestPrompts(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge')

  const draft = textOf(input, 'draft')
  if (draft === null) return refused('badInput')

  // Suggestions are written FOR a model — its own vocabulary, its own parameters — so there is
  // no useful answer without one armed.
  const prepared = mountedGenerator()?.body()
  if (!prepared) return refused('generatorClosed')

  const suggestions = await bridge.scenario.suggestPrompts({
    modelId: prepared.modelId,
    prompt: draft,
  })
  return { ok: true, data: suggestions }
}

async function translatePrompt(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge')

  const text = textOf(input, 'text')
  if (text === null) return refused('badInput')

  return { ok: true, data: await bridge.scenario.translatePrompt(text) }
}

async function describeStyle(): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge')

  const generator = mountedGenerator()
  if (!generator) return refused('generatorClosed')

  const references = generator.references()
  // Not a failure and not a guess: with nothing on the form there is no style to read, and the
  // channel refuses an empty list anyway.
  if (references.length === 0) return refused('noReference')

  return { ok: true, data: await bridge.scenario.describeStyle(references) }
}

/**
 * Runs an action, asking first when it engages anything.
 *
 * The gate sits here rather than in the main process, and that is deliberate: the figure quoted
 * comes from the form the window is showing, which the main process cannot see, and the question
 * is asked on a screen only the window has. It also means there is one gate rather than two —
 * whether the call came from the modal or from an MCP client on the other side of the machine,
 * it arrives at this function and is asked about the same way.
 */
export async function runConfirmedAction(
  name: ActionName,
  input: Record<string, unknown>,
): Promise<ActionOutcome> {
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
