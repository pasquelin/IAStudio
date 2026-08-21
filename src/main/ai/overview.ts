import type { AiOverview, ModelCandidate, RoleRow } from '@shared/domain/aiOverview'
import {
  allRoles,
  providerFor,
  roleChoicesFor,
  type AiRoleId,
  type RoleChoices,
} from '@shared/domain/aiRole'
import { cloudsServing } from '@shared/domain/aiCloud'
import type { MemorySnapshot } from '@shared/domain/aiMemory'
import type { DownloadProgress, LocalModel } from '@shared/domain/localModel'
import { fitAllowsUse, fitReadingOf } from '@shared/domain/modelFit'
import type { HardwareFacts } from './hardwareProbe'

/**
 * Composing what the manager screen reads, from the pieces that already answer separately.
 *
 * Pure: the machine reading, the catalogue and the choices all arrive as arguments, so the shape
 * of the screen is testable without a disk, a network or an account.
 */
export type OverviewInput = {
  readonly facts: HardwareFacts
  readonly snapshot: MemorySnapshot
  readonly choices: RoleChoices
  readonly projectChoices: Readonly<Record<string, RoleChoices>>
  readonly projectPath: string | null
  /** What the catalogue offers for a role, in the order it offers them. */
  readonly modelsFor: (role: AiRoleId) => readonly LocalModel[]
  readonly isInstalled: (model: LocalModel) => boolean
  /** Whether the runtime that would host this model is answering — see `localRuntimes.ts`. */
  readonly runtimeReady: (model: LocalModel) => boolean
  /** The clouds an account is held for. What each of them SERVES is its own declaration. */
  readonly readyClouds: readonly string[]
  readonly installing: { readonly modelId: string; readonly progress: DownloadProgress } | null
}

/**
 * The model a role would take on its own: the first candidate that is installed AND usable.
 *
 * Installed first, and not merely the best fit: offering a role a model nobody downloaded would
 * have it answer nothing until someone noticed.
 */
function localOptionsFor(candidates: readonly ModelCandidate[]): readonly string[] {
  return candidates.filter(one => one.installed && fitAllowsUse(one.fit)).map(one => one.model.id)
}

function rowFor(role: AiRoleId, input: OverviewInput, choices: RoleChoices): RoleRow {
  const candidates: readonly ModelCandidate[] = input.modelsFor(role).map(model => {
    const installed = input.isInstalled(model)
    const offer = {
      snapshot: input.snapshot,
      diskFreeBytes: input.facts.diskFreeBytes,
      installed,
      runtimeReady: input.runtimeReady(model),
    }

    return { model, installed, ...fitReadingOf(model, offer) }
  })

  // A key HELD is not an endpoint behind it: a cloud is offered only where it DECLARES serving
  // the role, or the screen says an employment is served when nothing serves it.
  const clouds = cloudsServing(role).filter(id => input.readyClouds.includes(id))

  return {
    role,
    provider: providerFor(role, choices, {
      localModelIds: localOptionsFor(candidates),
      installedModelIds: candidates.filter(one => one.installed).map(one => one.model.id),
      cloudIds: clouds,
    }),
    chosen: chosenPerScope(role, input),
    candidates,
    clouds,
  }
}

/** What each scope holds for the role — never what serves it, which `provider` answers. */
function chosenPerScope(role: AiRoleId, input: OverviewInput): RoleRow['chosen'] {
  const forProject =
    input.projectPath === null ? undefined : input.projectChoices[input.projectPath]

  return { app: input.choices[role] ?? null, project: forProject?.[role] ?? null }
}

export function aiOverviewOf(input: OverviewInput): AiOverview {
  const choices = roleChoicesFor(input.choices, input.projectChoices, input.projectPath)

  return {
    // Only the roles something could serve: twenty-one rows, most of them empty, would bury the
    // two that answer. A role with no candidate and no account has nothing to offer or explain.
    roles: allRoles()
      .map(role => rowFor(role, input, choices))
      .filter(row => row.candidates.length > 0 || row.clouds.length > 0),
    machine: {
      physicalBytes: input.facts.physicalBytes,
      availableBytes: input.snapshot.availableBytes,
      diskFreeBytes: input.facts.diskFreeBytes,
      gpu: input.facts.gpu?.renderer ?? null,
    },
    projectPath: input.projectPath,
    installing: input.installing,
  }
}
