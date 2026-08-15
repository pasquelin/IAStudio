import {
  type ActionCommitment,
  type ActionName,
  type ActionRefusal,
  commitmentOfCommand,
} from '@shared/domain/assistant'
import { commandDescriptor, type CommandId, scopeOfWorkspace } from '@shared/domain/command'
import { MODEL_FAMILIES } from '@shared/domain/model'
import { WORKSPACE_IDS, type WorkspaceId } from '@shared/domain/workspace'
import { isRecord } from '@shared/guards'
import { showWorkspace } from '@/app/dockview-api'
import { createDocumentIn } from '@/app/new-document'
import { openGeneratorOn } from '@/helpers/generation'
import { revealTool } from '@/helpers/reveal-panel'
import { getBridge } from '@/services/bridge'
import { publishCommand } from '@/services/command-bus'
import { useJobs } from '@/stores/jobs'
import { toolSurface } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { mountedGenerator } from './generator-bridge'

/**
 * What running an action answered.
 *
 * A refusal carries a key rather than a sentence, for the usual reason and for a second one: the
 * same outcome is read twice, by the person watching the modal in their own language and by the
 * model deciding what to do next, which reads English. One key, two renderings.
 */
export type ActionOutcome = { ok: true; data?: unknown } | { ok: false; refusal: ActionRefusal }

const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

/**
 * The inputs are read rather than asserted.
 *
 * They arrive validated — the main process checks them against the registry's fields before it
 * asks for any of this — so a guard here is belt and braces. It is worth the four lines all the
 * same: what fills these values is a language model, the one caller in the studio that answers
 * something plausible instead of failing, and a wrong `workspace` would otherwise reach
 * `showWorkspace` as a string it has no panel for.
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
  const descriptor = id === null ? null : commandDescriptor(asCommandId(id))
  if (!descriptor) return refused('unknownCommand')

  // `global` commands are the native menu's own, and Electron fires them itself — the bus never
  // carries them, so publishing one here would do nothing at all.
  if (descriptor.scope === 'global') return refused('globalCommand')

  if (scopeOfWorkspace(toolSurface()) !== descriptor.scope) return refused('wrongSurface')

  publishCommand(descriptor.id)
  return { ok: true }
}

/**
 * The one cast in the file, and the reason it is safe: `commandDescriptor` answers `null` for
 * anything the registry does not declare, so the value is checked by the very call it is passed
 * to. Narrowing it beforehand would mean walking the registry twice.
 */
function asCommandId(id: string): CommandId {
  return id as CommandId
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
  }
}

/**
 * What this call would engage, which for `command.run` is a fact of the command it names.
 *
 * Answered here rather than read off the registry row, because the row can only state the floor:
 * running `canvas.cutout` uploads a picture and running `canvas.zoomIn` does not, and both are
 * the same action.
 */
export function commitmentOfCall(
  name: ActionName,
  input: Record<string, unknown>,
): ActionCommitment {
  if (name === 'generator.submit') return 'credits'
  if (name !== 'command.run') return 'none'

  const id = textOf(input, 'command')
  return id === null ? 'none' : commitmentOfCommand(asCommandId(id))
}
