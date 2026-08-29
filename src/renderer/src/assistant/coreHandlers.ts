import { findActions, refused, type ActionOutcome } from '@shared/domain/assistant'
import { commandDescriptor } from '@shared/domain/command'
import { primaryRoleOf } from '@shared/domain/aiRole'
import { LANDING_TARGETS } from '@shared/domain/landingTarget'
import { MODEL_FAMILIES } from '@shared/domain/model'
import { SCENE_TEMPLATE_IDS } from '@shared/domain/sceneTemplate'
import { WORKSPACE_IDS } from '@shared/domain/workspace'
import { englishText } from '@shared/i18n'
import { showWorkspace } from '@/app/dockviewApi'
import { createDocumentIn } from '@/app/newDocument'
import { openGeneratorOn } from '@/helpers/openGenerator'
import { revealTool } from '@/helpers/revealPanel'
import { routeCommand, type CommandRouting } from '@/services/commandRouter'
import { useJobs } from '@/stores/jobs'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
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

/** What the router made of it, in the assistant's own words. */
const ROUTED: Record<CommandRouting, ActionOutcome> = {
  ran: { ok: true },
  noSurface: refused('wrongSurface'),
  // What the command names is there, and there is nothing left for it to do — a space already at
  // the end of the bar. `failed` would blame the studio for what is a fact of the input.
  nothingToDo: refused('notFound'),
  noBridge: refused('noBridge'),
}

/**
 * Fires a command wherever it belongs, through the router the native menu uses.
 *
 * Nothing is decided here: a second copy of that routing is what let ten commands be offered by
 * the tool schema and refused by the handler for as long as the two existed side by side.
 */
function runCommand(input: Record<string, unknown>): ActionOutcome {
  const descriptor = commandDescriptor(textOf(input, 'command') ?? '')
  if (!descriptor) return refused('unknownCommand')
  // 🛑 A native modal cannot be filled from here, cannot be read back, and the next round ran the
  // command again — a second Finder over the first. The action that takes a path does this.
  if (descriptor.raisesDialog) return refused('nativeDialog')

  return ROUTED[routeCommand(descriptor.id)]
}

async function submitPrepared(input: Record<string, unknown>): Promise<ActionOutcome> {
  const generator = mountedGenerator()
  if (!generator) {
    // Opened rather than merely refused: the next attempt then has somewhere to land, and the
    // panel is what the person needs to see to judge what is about to be sent.
    revealTool('generator')
    return refused('generatorClosed')
  }

  const armed = generator.armed()
  if (!armed) return refused('nothingPrepared')

  // 🛑 What the call names, else what the panel shows — and a refusal rather than a default
  // where the studio itself would have asked. Its options travel in `detail`, the half a client
  // reads: a refusal naming nothing was sent again word for word 384 times on 2026-08-25.
  const into = oneOf(input, 'landing', LANDING_TARGETS) ?? armed.landing.target
  if (into === null) {
    return refused('ambiguousLanding', `name landing: one of ${LANDING_TARGETS.join(', ')}`)
  }

  const job = await generator.submit(into)
  return job ? { ok: true, data: { jobId: job.id, landing: into } } : refused('notSubmitted')
}

/** What is armed, before a call may quote a cost or spend one — model, operation, sources, where. */
function armedGeneration(): ActionOutcome {
  const armed = mountedGenerator()?.armed()
  if (!armed) return refused('generatorClosed')

  return { ok: true, data: armed }
}

function prepareGenerator(input: Record<string, unknown>): ActionOutcome {
  const family = oneOf(input, 'family', MODEL_FAMILIES)
  const parameters = recordOf(input, 'parameters')
  if (!family || !parameters) return refused('badInput')

  openGeneratorOn(
    family,
    textOf(input, 'modelId') ?? '',
    parameters,
    textOf(input, 'operation') ?? undefined,
  )
  return { ok: true }
}

// Waits for the document: the creation puts a name field on screen, and answering before it is
// filled told a client "done" about one the person then called off.
async function openWorkspace(input: Record<string, unknown>): Promise<ActionOutcome> {
  const workspace = oneOf(input, 'workspace', WORKSPACE_IDS)
  if (!workspace) return refused('badInput')

  if (!boolOf(input, 'createDocument')) {
    showWorkspace(workspace)
    return { ok: true }
  }

  // Asked here although the creation asks it too: from there it answers `null`, which is the
  // person's own refusal — and "you turned that down" for a studio with no project open is a lie.
  if (!useProject.getState().project) return refused('noProject')

  const title = textOf(input, 'title')
  const folder = textOf(input, 'folder')
  // Only alongside a title, and for the same reason the folder is: with no title the naming
  // window opens, and what it puts on screen is the person's own choice to make.
  const template = oneOf(input, 'template', SCENE_TEMPLATE_IDS)
  const created = await createDocumentIn(
    workspace,
    title === null
      ? undefined
      : {
          title,
          ...(folder === null ? {} : { folder }),
          ...(template === null ? {} : { template }),
        },
  )
  return created ? { ok: true, data: { documentId: created.id } } : refused('declined')
}

/**
 * Suggestions are written FOR a model — its own vocabulary, its own parameters — so there is no
 * useful answer without one armed.
 */
function suggestPrompts(input: Record<string, unknown>): Promise<ActionOutcome> {
  const prepared = mountedGenerator()?.body()
  if (!prepared) return Promise.resolve(refused('generatorClosed'))

  return withBridge(bridge =>
    bridge.provider.suggestPrompts({
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

  return withBridge(bridge => bridge.provider.describeStyle(references))
}

/**
 * The catalogue, searched — how a model shown the short list learns what else there is.
 *
 * English, like the catalogue a model is shown and the tools an MCP client reads: the answer is
 * read by a program, not by the person at the machine.
 */
function findInCatalogue(input: Record<string, unknown>): ActionOutcome {
  const query = textOf(input, 'query')
  if (query === null) return refused('badInput')

  return {
    ok: true,
    // The field DESCRIPTORS as they stand, plus their English label: listing the three properties
    // that seemed useful dropped `repeated`, `min` and `max`, so a client discovering an action
    // here got a weaker contract than the same tool in `tools/list`.
    data: findActions(query).map(found => ({
      name: found.name,
      description: englishText(found.descriptionKey),
      fields: found.fields.map(field => ({ ...field, label: englishText(field.labelKey) })),
    })),
  }
}

export const CORE_HANDLERS: ActionHandlers = {
  'command.run': runCommand,
  'actions.find': findInCatalogue,
  'workspace.open': openWorkspace,
  'generator.prepare': prepareGenerator,
  'generator.armed': armedGeneration,
  'generator.submit': submitPrepared,
  'prompt.suggest': suggestPrompts,
  'prompt.describeStyle': describeStyle,

  'models.search': input => {
    const family = oneOf(input, 'family', MODEL_FAMILIES)
    return withBridge(async bridge => {
      const page = await bridge.provider.searchModels({
        search: textOf(input, 'query') ?? '',
        ...(family ? { family } : {}),
      })
      return page.items.map(model => ({ id: model.id, name: model.name, family: model.family }))
    })
  },

  'models.select': input => {
    const family = oneOf(input, 'family', MODEL_FAMILIES)
    if (!family) return refused('badInput')

    // The door names a family, which is what an MCP client can be expected to know. The pick
    // arms its FIRST employment — the one that family generates with when nothing narrower is
    // asked for, and the one this call armed before choices were filed per employment.
    const role = primaryRoleOf(family)
    if (!role) return refused('badInput')

    useModels.getState().select(role, textOf(input, 'modelId') ?? '')
    return { ok: true }
  },

  /**
   * Whole jobs, `assetIds` above all. Four fields were picked out here — id, label, status,
   * progress — which made a client able to start a generation and unable to learn what it
   * produced, or what it cost, or why it failed.
   */
  'jobs.list': () => ({ ok: true, data: useJobs.getState().jobs }),

  'prompt.translate': input =>
    withBridge(bridge => bridge.provider.translatePrompt(textOf(input, 'text') ?? '')),

  /**
   * Recognised here, carried out by the conversation itself — see `say` in `stores/assistant`.
   * Not `hide()` on this line: that store imports the executor to run a plan, and reaching back
   * into it would close the loop between the two.
   */
  'chat.close': () => ({ ok: true }),
}
