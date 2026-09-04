import type { ActionSearchService } from '@main/actionIndex/actionSearchService'
import type { ActionHit } from '@main/actionIndex/actionIndex'
import type { MemoryVectors } from '@main/memory/memoryVectors'
import type { ProjectContextStore } from '@main/project/context'
import type { JobManager } from '@main/provider/jobManager'
import type { Memory, MemoryRef } from '@shared/domain/assistantMemory'
import type { Job } from '@shared/domain/job'
import type { Mission, MissionStep } from '@shared/domain/mission'
import { ACTION_REGISTRY, type ActionResource } from '@shared/domain/assistant'
import { noContext, type ContextState } from '@shared/domain/projectContext'
import type { StudioSnapshot } from '@shared/domain/studioSnapshot'
import type {
  AssistantContext,
  ContextBudgetReport,
  ContextSource,
  MissionContext,
  VisualContext,
  WorkspaceContext,
} from './context'
import { CONTEXT_BUDGETS, emptyBudgetReport, withinBudget } from './contextBudget'

type AssistantContextRequest = {
  mission: Mission
  step: MissionStep
  request: string
  visual?: boolean
}

export type AssistantContextBuilder = {
  build: (request: AssistantContextRequest) => Promise<AssistantContext>
}

export type AssistantContextBuilderDeps = {
  snapshot: () => Promise<StudioSnapshot | null>
  actions: Pick<ActionSearchService, 'search'>
  memories: Pick<MemoryVectors, 'recall'>
  jobs: Pick<JobManager, 'list'>
  projectContext: Pick<ProjectContextStore, 'read'>
  documentState?: (document: StudioSnapshot['documents'][number]) => Promise<unknown>
  visual?: (document: StudioSnapshot['documents'][number]) => Promise<VisualContext | null>
}

function rememberedRefs(snapshot: StudioSnapshot | null): readonly MemoryRef[] {
  if (!snapshot) return []
  const active = snapshot.documents.find(document => document.active)
  const refs: MemoryRef[] = []
  if (active) refs.push({ kind: 'document', ref: active.id })
  if (snapshot.selection?.kind === 'node') {
    for (const item of snapshot.selection.items) refs.push({ kind: 'node', ref: item.id })
  }
  return refs
}

function selected<T>(
  report: ContextBudgetReport,
  source: ContextSource,
  values: readonly T[],
  measure?: (value: T) => unknown,
): readonly T[] {
  const bounded = withinBudget(values, CONTEXT_BUDGETS[source], measure)
  const contentTruncated = report[source].contentTruncated
  report[source] = {
    ...bounded.report,
    contentTruncated,
    truncated: bounded.report.truncated || contentTruncated,
  }
  return bounded.values
}

function textWithin(text: string, maximum: number): string {
  return text.length <= maximum ? text : `${text.slice(0, maximum - 1)}…`
}

function compactValue(value: unknown, maximum: number): { value: unknown; truncated: boolean } {
  const serialized = JSON.stringify(value)
  return serialized === undefined || serialized.length <= maximum
    ? { value, truncated: false }
    : { value: { truncated: true, preview: textWithin(serialized, maximum) }, truncated: true }
}

function markContentTruncated(report: ContextBudgetReport, source: ContextSource): void {
  report[source] = { ...report[source], truncated: true, contentTruncated: true }
}

function retrievalQuery(input: AssistantContextRequest): string {
  return [
    ...new Set(
      [
        textWithin(input.mission.goal, 480),
        textWithin(input.request, 480),
        textWithin(input.step.title, 160),
      ].filter(Boolean),
    ),
  ].join('\n')
}

function availableActionResources(
  input: AssistantContextRequest,
  snapshot: StudioSnapshot | null,
): readonly ActionResource[] {
  const resources = new Set<ActionResource>()
  if (Object.keys(snapshot?.armedModels ?? {}).length > 0) resources.add('selectedGenerationModel')
  for (const step of input.mission.plan.steps) {
    if (step.kind !== 'action' || step.state !== 'completed') continue
    const descriptor = ACTION_REGISTRY.find(action => action.name === step.call.action)
    for (const resource of descriptor?.produces ?? []) resources.add(resource)
  }
  return [...resources]
}

function rankedCards(context: ContextState, query: string): ContextState {
  const words = query.toLocaleLowerCase('en').match(/[\p{L}\p{N}_]+/gu) ?? []
  const cards = context.cards
    .map((card, ordinal) => ({
      card,
      ordinal,
      score: words.filter(word =>
        `${card.title} ${card.body}`.toLocaleLowerCase('en').includes(word),
      ).length,
    }))
    .sort((left, right) => right.score - left.score || left.ordinal - right.ordinal)
    .map(entry => entry.card)
  return { ...context, cards }
}

type CollectedContext = {
  actions: readonly ActionHit[]
  memories: readonly Memory[]
  jobs: readonly Job[]
  projectContext: ContextState
  documentState?: unknown
  visual?: VisualContext
}

async function collectDocumentContext(
  deps: AssistantContextBuilderDeps,
  input: AssistantContextRequest,
  snapshot: StudioSnapshot | null,
): Promise<readonly [unknown, VisualContext | null]> {
  const active = snapshot?.documents.find(document => document.active)
  const state =
    active && deps.documentState
      ? await deps.documentState(active)
      : snapshot?.activeDocumentState?.state
  const visual = input.visual && active && deps.visual ? await deps.visual(active) : null
  return [state, visual]
}

async function collectContext(
  deps: AssistantContextBuilderDeps,
  input: AssistantContextRequest,
  snapshot: StudioSnapshot | null,
): Promise<CollectedContext> {
  const query = retrievalQuery(input)
  const refs = rememberedRefs(snapshot)
  const attached =
    input.mission.projectId !== undefined && snapshot?.project?.path === input.mission.projectId
  const [actions, projectMemories, globalMemories, jobs, projectContext, document] =
    await Promise.all([
      deps.actions.search(
        query,
        CONTEXT_BUDGETS.actions.maxItems,
        availableActionResources(input, snapshot),
      ),
      attached
        ? deps.memories.recall('project', {
            text: query,
            refs,
            limit: CONTEXT_BUDGETS.memories.maxItems,
          })
        : Promise.resolve([]),
      deps.memories.recall('global', {
        text: query,
        refs,
        limit: CONTEXT_BUDGETS.memories.maxItems,
      }),
      Promise.resolve(deps.jobs.list()),
      attached ? deps.projectContext.read() : Promise.resolve(noContext()),
      collectDocumentContext(deps, input, snapshot),
    ])
  return {
    actions,
    memories: [
      ...new Map(
        [...projectMemories, ...globalMemories].map(memory => [memory.id, memory]),
      ).values(),
    ],
    jobs,
    projectContext: rankedCards(projectContext, query),
    ...(document[0] === undefined ? {} : { documentState: document[0] }),
    ...(document[1] ? { visual: document[1] } : {}),
  }
}

function visualContext(collected: CollectedContext, report: ContextBudgetReport) {
  const accepted =
    collected.visual && collected.visual.bytes.byteLength <= (CONTEXT_BUDGETS.visual.maxBytes ?? 0)
      ? [collected.visual]
      : []
  report.visual = {
    ...report.visual,
    considered: collected.visual ? 1 : 0,
    selected: accepted.length,
    truncated: collected.visual !== undefined && accepted.length === 0,
  }
  return accepted
}

function previousResults(input: AssistantContextRequest, report: ContextBudgetReport) {
  return input.mission.plan.steps
    .filter(
      step => step.state === 'completed' && step.result !== undefined && step.id !== input.step.id,
    )
    .map(step => {
      const result = compactValue(step.result, 600)
      if (result.truncated || step.title.length > 160) markContentTruncated(report, 'results')
      return { stepId: step.id, title: textWithin(step.title, 160), result: result.value }
    })
    .sort(
      (left, right) =>
        Number(input.step.dependsOn.includes(right.stepId)) -
        Number(input.step.dependsOn.includes(left.stepId)),
    )
}

function relevantJobs(input: AssistantContextRequest, jobs: readonly Job[]): readonly Job[] {
  const ids = new Set([
    ...input.mission.waits.flatMap(wait => (wait.kind === 'job' ? [wait.jobId] : [])),
    ...input.mission.plan.steps.flatMap(step => (step.kind === 'job' ? [step.jobId] : [])),
  ])
  return jobs.filter(job => ids.has(job.id))
}

function missionContext(
  input: AssistantContextRequest,
  report: ContextBudgetReport,
): MissionContext {
  const step = {
    id: input.step.id,
    title: textWithin(input.step.title, 160),
    kind: input.step.kind,
    state: input.step.state,
    dependsOn: input.step.dependsOn.slice(0, 12),
    ...(input.step.kind === 'action' ? { actionName: input.step.call.action } : {}),
    ...(input.step.kind === 'job' ? { jobId: input.step.jobId } : {}),
    ...(input.step.kind === 'sub_mission' ? { childMissionId: input.step.childMissionId } : {}),
  }
  const context = selected(report, 'mission', [
    {
      id: input.mission.id,
      goal: textWithin(input.mission.goal, 480),
      state: input.mission.state,
      revision: input.mission.revision,
      step,
      request: textWithin(input.request, 480),
    },
  ])[0]
  if (
    input.mission.goal.length > 480 ||
    input.request.length > 480 ||
    input.step.title.length > 160 ||
    input.step.dependsOn.length > 12
  ) {
    markContentTruncated(report, 'mission')
  }
  if (!context) throw new Error('mission context exceeds its own budget')
  return context
}

function workspaceContext(
  snapshot: StudioSnapshot | null,
  report: ContextBudgetReport,
): WorkspaceContext | null {
  if (!snapshot) return null
  const armedModels = Object.fromEntries(
    Object.entries(snapshot.armedModels).flatMap(([role, model]) =>
      model === undefined ? [] : [[role, textWithin(model, 120)]],
    ),
  )
  const tasks = snapshot.tasks.slice(0, 4).map(task => ({
    ...task,
    label: textWithin(task.label, 80),
  }))
  const context =
    selected(report, 'workspace', [
      {
        workspace: snapshot.workspace,
        surface: snapshot.surface,
        commandScope: snapshot.commandScope,
        armedModels,
        play: snapshot.play,
        tasks,
        authenticated: snapshot.authenticated,
        authKnown: snapshot.authKnown,
      },
    ])[0] ?? null
  if (
    snapshot.tasks.length > tasks.length ||
    snapshot.tasks.some(task => task.label.length > 80) ||
    Object.values(snapshot.armedModels).some(model => (model?.length ?? 0) > 120)
  ) {
    markContentTruncated(report, 'workspace')
  }
  return context
}

function snapshotContext(snapshot: StudioSnapshot | null, report: ContextBudgetReport) {
  const document = selected(
    report,
    'document',
    snapshot?.documents.filter(one => one.active) ?? [],
  )[0]
  const project = selected(report, 'project', snapshot?.project ? [snapshot.project] : [])[0]
  const items = selected(report, 'selection', snapshot?.selection?.items ?? [])
  const selection =
    snapshot?.selection && items.length > 0
      ? { ...snapshot.selection, items: [...items] }
      : undefined
  return { document, project, selection, workspace: workspaceContext(snapshot, report) }
}

function projectContext(
  collected: CollectedContext,
  report: ContextBudgetReport,
): AssistantContext['projectContext'] {
  const cards = selected(
    report,
    'projectContext',
    collected.projectContext.cards.filter(card => card.active),
  )
  return cards.length > 0 || collected.projectContext.trouble
    ? { cards, trouble: collected.projectContext.trouble }
    : undefined
}

function assembledContext(
  input: AssistantContextRequest,
  snapshot: StudioSnapshot | null,
  collected: CollectedContext,
): AssistantContext {
  const report = emptyBudgetReport()
  const current = snapshotContext(snapshot, report)
  const compactState = compactValue(
    collected.documentState,
    CONTEXT_BUDGETS.documentState.maxCharacters,
  )
  if (compactState.truncated) markContentTruncated(report, 'documentState')
  const state = selected(
    report,
    'documentState',
    collected.documentState === undefined ? [] : [compactState.value],
  )[0]
  const context = projectContext(collected, report)
  const visual = visualContext(collected, report)
  return {
    mission: missionContext(input, report),
    workspace: current.workspace,
    project: current.project ?? null,
    ...(current.document ? { document: current.document } : {}),
    ...(current.selection ? { selection: current.selection } : {}),
    ...(state === undefined ? {} : { documentState: state }),
    actions: selected(report, 'actions', collected.actions, hit => ({
      name: hit.action.name,
      score: hit.score,
    })),
    memories: selected(report, 'memories', collected.memories),
    jobs: selected(report, 'jobs', relevantJobs(input, collected.jobs)),
    previousResults: selected(report, 'results', previousResults(input, report)),
    ...(context ? { projectContext: context } : {}),
    ...(visual.length > 0 ? { visual } : {}),
    budget: report,
  }
}

export function createAssistantContextBuilder(
  deps: AssistantContextBuilderDeps,
): AssistantContextBuilder {
  return {
    build: async input => {
      if (input.step.missionId !== input.mission.id) {
        throw new Error('context step belongs to another mission')
      }
      const readSnapshot = await deps.snapshot()
      const snapshot =
        input.mission.projectId && readSnapshot?.project?.path !== input.mission.projectId
          ? null
          : readSnapshot
      const collected = await collectContext(deps, input, snapshot)
      return assembledContext(input, snapshot, collected)
    },
  }
}
