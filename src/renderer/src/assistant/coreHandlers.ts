import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { commandDescriptor, scopeOfWorkspace } from '@shared/domain/command'
import { MODEL_FAMILIES } from '@shared/domain/model'
import { WORKSPACE_IDS } from '@shared/domain/workspace'
import { showWorkspace } from '@/app/dockviewApi'
import { createDocumentIn } from '@/app/newDocument'
import { openGeneratorOn } from '@/helpers/openGenerator'
import { revealTool } from '@/helpers/revealPanel'
import { publishCommand } from '@/services/commandBus'
import { runGlobalCommand } from '@/services/globalCommands'
import { useJobs } from '@/stores/jobs'
import { toolSurface } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { withBridge, type ActionHandlers } from './actionHandler'
import { boolOf, oneOf, recordOf, textOf } from './actionInputs'
import { mountedGenerator } from './generatorBridge'

/**
 * The eleven a spoken request needs.
 *
 * Every branch calls the helper the studio already uses for that gesture — the rail's own way of
 * making a document, the inspector's own way of opening the generator. Nothing here is a second
 * path to an existing behaviour.
 */

/**
 * Fires a command at the surface listening for it, having first checked one is.
 *
 * `publishCommand` is memoryless and filtered by scope on the subscriber's side: a command sent
 * while no document of that scope is active is dropped in silence. Right for a menu, whose rows
 * grey out, and wrong here — the assistant would report having done something that never happened.
 */
function runCommand(input: Record<string, unknown>): ActionOutcome {
  const descriptor = commandDescriptor(textOf(input, 'command') ?? '')
  if (!descriptor) return refused('unknownCommand')

  // `global` commands never travel the bus: they run through the same module the native menu
  // goes through. The three the main process performs itself answer `false`.
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
    // panel is what the person needs to see to judge what is about to be sent.
    revealTool('generator')
    return refused('generatorClosed')
  }

  if (!generator.body()) return refused('nothingPrepared')

  const job = await generator.submit()
  return job ? { ok: true, data: { jobId: job.id } } : refused('notSubmitted')
}

function prepareGenerator(input: Record<string, unknown>): ActionOutcome {
  const family = oneOf(input, 'family', MODEL_FAMILIES)
  const parameters = recordOf(input, 'parameters')
  if (!family || !parameters) return refused('badInput')

  openGeneratorOn(family, textOf(input, 'modelId') ?? '', parameters)
  return { ok: true }
}

function openWorkspace(input: Record<string, unknown>): ActionOutcome {
  const workspace = oneOf(input, 'workspace', WORKSPACE_IDS)
  if (!workspace) return refused('badInput')

  if (boolOf(input, 'createDocument')) createDocumentIn(workspace)
  else showWorkspace(workspace)
  return { ok: true }
}

/**
 * Suggestions are written FOR a model — its own vocabulary, its own parameters — so there is no
 * useful answer without one armed.
 */
function suggestPrompts(input: Record<string, unknown>): Promise<ActionOutcome> {
  const prepared = mountedGenerator()?.body()
  if (!prepared) return Promise.resolve(refused('generatorClosed'))

  return withBridge(bridge =>
    bridge.scenario.suggestPrompts({
      modelId: prepared.modelId,
      prompt: textOf(input, 'draft') ?? '',
    }),
  )
}

function describeStyle(): Promise<ActionOutcome> {
  const generator = mountedGenerator()
  if (!generator) return Promise.resolve(refused('generatorClosed'))

  const references = generator.references()
  // Not a failure and not a guess: with nothing on the form there is no style to read, and the
  // channel refuses an empty list anyway.
  if (references.length === 0) return Promise.resolve(refused('noReference'))

  return withBridge(bridge => bridge.scenario.describeStyle(references))
}

export const CORE_HANDLERS: ActionHandlers = {
  'command.run': runCommand,
  'workspace.open': openWorkspace,
  'generator.prepare': prepareGenerator,
  'generator.submit': submitPrepared,
  'prompt.suggest': suggestPrompts,
  'prompt.describeStyle': describeStyle,

  'models.search': input => {
    const family = oneOf(input, 'family', MODEL_FAMILIES)
    return withBridge(async bridge => {
      const page = await bridge.scenario.searchModels({
        search: textOf(input, 'query') ?? '',
        ...(family ? { family } : {}),
      })
      return page.items.map(model => ({ id: model.id, name: model.name, family: model.family }))
    })
  },

  'models.select': input => {
    const family = oneOf(input, 'family', MODEL_FAMILIES)
    if (!family) return refused('badInput')

    useModels.getState().select(family, textOf(input, 'modelId') ?? '')
    return { ok: true }
  },

  /**
   * Whole jobs, `assetIds` above all. Four fields were picked out here — id, label, status,
   * progress — which made a client able to start a generation and unable to learn what it
   * produced, or what it cost, or why it failed.
   */
  'jobs.list': () => ({ ok: true, data: useJobs.getState().jobs }),

  'prompt.translate': input =>
    withBridge(bridge => bridge.scenario.translatePrompt(textOf(input, 'text') ?? '')),

  /**
   * Recognised here, carried out by the conversation itself — see `say` in `stores/assistant`.
   * Not `hide()` on this line: that store imports the executor to run a plan, and reaching back
   * into it would close the loop between the two.
   */
  'chat.close': () => ({ ok: true }),
}
