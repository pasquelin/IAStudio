import type { ActionOutcome, ActionRefusal } from '@shared/domain/assistant'
import { commandDescriptor, scopeOfWorkspace } from '@shared/domain/command'
import { MODEL_FAMILIES } from '@shared/domain/model'
import { WORKSPACE_IDS, type WorkspaceId } from '@shared/domain/workspace'
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
import type { ActionHandlers } from './actionHandler'
import { oneOf, recordOf, textOf } from './actionInputs'
import { mountedGenerator } from './generatorBridge'

/**
 * The eleven a spoken request needs.
 *
 * Every branch calls the helper the studio already uses for that gesture — the rail's own way of
 * making a document, the inspector's own way of opening the generator. Nothing here is a second
 * path to an existing behaviour, which is what keeps the assistant from drifting away from what
 * the buttons do.
 */

const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

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
  const parameters = recordOf(input, 'parameters')

  if (!family || modelId === null || !parameters) return refused('badInput')

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

export const CORE_HANDLERS: ActionHandlers = {
  'command.run': runCommand,
  'workspace.open': openWorkspace,
  'models.search': searchModels,
  'models.select': selectModel,
  'generator.prepare': prepareGenerator,
  'generator.submit': submitPrepared,
  /**
   * Whole jobs, `assetIds` above all.
   *
   * Four fields were picked out here — id, label, status, progress — which made a client able to
   * start a generation and unable to learn what it produced, or what it cost, or why it failed.
   * The type is the boundary's own and every field of it is meant to cross.
   */
  'jobs.list': () => ({ ok: true, data: useJobs.getState().jobs }),
  'prompt.suggest': suggestPrompts,
  'prompt.translate': translatePrompt,
  'prompt.describeStyle': describeStyle,
  /**
   * Recognised here, carried out by the conversation itself — see `say` in `stores/assistant`.
   *
   * Not `useAssistant.getState().hide()` on this line, tempting as it is: that store imports the
   * executor to run a plan, and reaching back into it would close the loop between the two. The
   * window belongs to the conversation, not to the executor of studio actions.
   */
  'chat.close': () => ({ ok: true }),
}
