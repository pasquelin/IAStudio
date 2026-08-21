import type { AiOverview, ModelCandidate, RoleRow } from '@shared/domain/aiOverview'
import {
  allRoles,
  providerFor,
  roleChoicesFor,
  type AiRoleId,
  type RoleChoices,
} from '@shared/domain/aiRole'
import type { MemorySnapshot } from '@shared/domain/aiMemory'
import type { DownloadProgress, LocalModel } from '@shared/domain/localModel'
import { fitAllowsUse, fitOf } from '@shared/domain/modelFit'
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
  /** Whether an account could answer at all. A role is not offered Scenario without one. */
  readonly scenarioReady: boolean
  readonly installing: { readonly modelId: string; readonly progress: DownloadProgress } | null
}

/**
 * The model a role would take on its own: the first candidate that is installed AND usable.
 *
 * Installed first, and not merely the best fit: offering a role a model nobody downloaded would
 * have it answer nothing until someone noticed.
 */
function localOptionFor(candidates: readonly ModelCandidate[]): string | null {
  return candidates.find(one => one.installed && fitAllowsUse(one.fit))?.model.id ?? null
}

function rowFor(role: AiRoleId, input: OverviewInput, choices: RoleChoices): RoleRow {
  const models = input.modelsFor(role)
  const candidates: readonly ModelCandidate[] = models.map(model => {
    const installed = input.isInstalled(model)
    return {
      model,
      installed,
      fit: fitOf(model, {
        snapshot: input.snapshot,
        diskFreeBytes: input.facts.diskFreeBytes,
        installed,
      }),
    }
  })

  return {
    role,
    provider: providerFor(role, choices, {
      localModelId: localOptionFor(candidates),
      scenarioReady: input.scenarioReady,
    }),
    chosenAt: chosenScopeOf(role, input),
    candidates,
    scenarioReady: input.scenarioReady,
  }
}

/** Where the choice that applies was written, so the screen can tell "inherited" from "set here". */
function chosenScopeOf(role: AiRoleId, input: OverviewInput): RoleRow['chosenAt'] {
  const fromProject =
    input.projectPath === null ? undefined : input.projectChoices[input.projectPath]
  if (fromProject?.[role] !== undefined) return 'project'
  return input.choices[role] === undefined ? null : 'app'
}

export function aiOverviewOf(input: OverviewInput): AiOverview {
  const choices = roleChoicesFor(input.choices, input.projectChoices, input.projectPath)

  return {
    // Only the roles something could serve: twenty-one rows, most of them empty, would bury the
    // two that answer. A role with no candidate and no account has nothing to offer or explain.
    roles: allRoles()
      .map(role => rowFor(role, input, choices))
      .filter(row => row.candidates.length > 0 || row.scenarioReady),
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
