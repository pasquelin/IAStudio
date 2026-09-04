import { describe, expect, it, vi } from 'vitest'
import {
  createMission,
  createMissionStep,
  type Mission,
  type MissionStep,
} from '@shared/domain/mission'
import type { Memory, MemoryRecallAsk, MemoryScope } from '@shared/domain/assistantMemory'
import type { Job } from '@shared/domain/job'
import type { StudioSnapshot } from '@shared/domain/studioSnapshot'
import { actionCorpus } from '@main/actionIndex/actionCorpus'
import type { ActionHit } from '@main/actionIndex/actionIndex'
import type { VisualContext } from './context'
import { createAssistantContextBuilder, type AssistantContextBuilderDeps } from './contextBuilder'

const clock = { now: () => '2026-09-04T10:00:00.000Z', newId: () => 'one' }

function missionOf(projectId?: string): {
  mission: Mission
  step: Mission['plan']['steps'][number]
} {
  const made = createMission('Create a project image', clock)
  const mission = projectId ? { ...made, projectId } : made
  const step = createMissionStep(mission.id, 'Choose the correct action', { kind: 'reason' }, clock)
  return { mission: { ...mission, plan: { steps: [step] } }, step }
}

function snapshotOf(path = '/projects/alpha'): StudioSnapshot {
  return {
    project: {
      path,
      manifest: { version: 1, createdAt: clock.now(), updatedAt: clock.now() },
    },
    projectKnown: true,
    workspace: 'image',
    surface: 'image',
    commandScope: 'canvas',
    documents: [
      {
        id: 'document_1',
        title: 'Boat',
        kind: 'image',
        workspace: 'image',
        path: 'documents/Boat.ora',
        active: true,
        modified: true,
      },
    ],
    selection: { kind: 'layer', items: [{ id: 'layer_1', name: 'Hull' }] },
    armedModels: {},
    play: 'edit',
    tasks: [],
    authenticated: true,
    authKnown: true,
  }
}

const memory: Memory = {
  id: 'memory_1',
  type: 'decision',
  summary: 'Use the selected layer',
  body: '',
  importance: 4,
  createdAt: clock.now(),
  source: { kind: 'assistant' },
  refs: [],
  links: [],
  state: 'live',
}

const job: Job = {
  id: 'job_1',
  targetId: 'model_1',
  label: 'Boat',
  status: 'running',
  progress: 0.5,
  createdAt: clock.now(),
  assetIds: [],
}

function dependencies(
  overrides: Partial<AssistantContextBuilderDeps> = {},
): AssistantContextBuilderDeps {
  return {
    snapshot: async () => snapshotOf(),
    actions: { search: async () => [] },
    memories: { recall: async () => [] },
    jobs: { list: () => [] },
    projectContext: { read: async () => ({ cards: [], trouble: null }) },
    ...overrides,
  }
}

describe('AssistantContextBuilder', () => {
  it('builds a useful context without a window or project', async () => {
    const { mission, step } = missionOf()
    const builder = createAssistantContextBuilder(dependencies({ snapshot: async () => null }))
    const context = await builder.build({ mission, step, request: 'Please continue' })
    expect(context).toMatchObject({
      mission: {
        id: mission.id,
        step: { id: step.id, kind: step.kind },
        request: 'Please continue',
      },
      workspace: null,
      project: null,
      actions: [],
      memories: [],
    })
  })

  it('collects matching project, document, selection, state, memory and jobs', async () => {
    const built = missionOf('/projects/alpha')
    const jobStep = createMissionStep(
      built.mission.id,
      'Wait for boat',
      { kind: 'job', jobId: job.id },
      clock,
    )
    const mission = { ...built.mission, plan: { steps: [built.step, jobStep] } }
    const step = built.step
    const recall = vi.fn(async () => [memory])
    const builder = createAssistantContextBuilder(
      dependencies({
        memories: { recall },
        jobs: { list: () => [job] },
        projectContext: {
          read: async () => ({
            cards: [{ id: 'card_1', title: 'World', body: 'At sea', active: true, pictures: [] }],
            trouble: null,
          }),
        },
        documentState: async document => ({ id: document.id, layers: 3 }),
      }),
    )
    const context = await builder.build({ mission, step, request: 'Make the boat blue' })
    expect(context.document?.id).toBe('document_1')
    expect(context.selection?.items).toEqual([{ id: 'layer_1', name: 'Hull' }])
    expect(context.documentState).toEqual({ id: 'document_1', layers: 3 })
    expect(context.memories).toEqual([memory])
    expect(context.jobs).toEqual([job])
    expect(context.projectContext?.cards).toHaveLength(1)
    expect(recall).toHaveBeenCalledWith(
      'project',
      expect.objectContaining({
        refs: [{ kind: 'document', ref: 'document_1' }],
        limit: 6,
      }),
    )
  })

  it('does not contaminate a mission with another project window', async () => {
    const { mission, step } = missionOf('/projects/alpha')
    const recall = vi.fn(async () => [memory])
    const readContext = vi.fn(async () => ({ cards: [], trouble: null }))
    const builder = createAssistantContextBuilder(
      dependencies({
        snapshot: async () => snapshotOf('/projects/beta'),
        memories: { recall },
        projectContext: { read: readContext },
      }),
    )
    const context = await builder.build({ mission, step, request: 'Continue' })
    expect(context.workspace).toBeNull()
    expect(context.document).toBeUndefined()
    expect(context.project).toBeNull()
    expect(recall).toHaveBeenCalledTimes(1)
    expect(recall).toHaveBeenCalledWith('global', expect.anything())
    expect(readContext).not.toHaveBeenCalled()
  })

  it('scores upstream then enforces every source budget independently', async () => {
    const built = missionOf('/projects/alpha')
    const jobSteps: MissionStep[] = Array.from({ length: 9 }, (_, at) => ({
      ...createMissionStep(
        built.mission.id,
        `Job ${at}`,
        { kind: 'job', jobId: `job_${at}` },
        clock,
      ),
      id: `step_job_${at}`,
    }))
    const mission = { ...built.mission, plan: { steps: [built.step, ...jobSteps] } }
    const step = built.step
    const actions: ActionHit[] = actionCorpus()
      .actions.slice(0, 8)
      .map((action, at) => ({
        action,
        score: 8 - at,
        lexicalScore: 8 - at,
      }))
    const builder = createAssistantContextBuilder(
      dependencies({
        actions: { search: async () => actions },
        jobs: { list: () => Array.from({ length: 9 }, (_, at) => ({ ...job, id: `job_${at}` })) },
      }),
    )
    const context = await builder.build({ mission, step, request: 'Find an action' })
    expect(context.actions).toHaveLength(8)
    expect(context.budget.actions).toMatchObject({ considered: 8, selected: 8, truncated: false })
    expect(context.jobs).toHaveLength(6)
    expect(context.budget.jobs).toMatchObject({ considered: 9, selected: 6, truncated: true })
  })

  it('compacts a valid long mission instead of dropping its required context', async () => {
    const built = missionOf('/projects/alpha')
    const mission = { ...built.mission, goal: 'g'.repeat(10_000) }
    const search = vi.fn(
      async (_query: string, _limit?: number): Promise<readonly ActionHit[]> => [],
    )
    const recall = vi.fn(
      async (_scope: MemoryScope, _ask: MemoryRecallAsk): Promise<readonly Memory[]> => [],
    )
    const builder = createAssistantContextBuilder(
      dependencies({ actions: { search }, memories: { recall } }),
    )
    const context = await builder.build({ mission, step: built.step, request: 'r'.repeat(10_000) })
    expect(context.mission.goal.endsWith('…')).toBe(true)
    expect(context.mission.request.endsWith('…')).toBe(true)
    expect(context.budget.mission).toMatchObject({ truncated: true, contentTruncated: true })
    expect(context.budget.mission.characters).toBeLessThanOrEqual(
      context.budget.mission.maxCharacters,
    )
    expect(search.mock.calls[0]?.[0].length).toBeLessThan(1_200)
    expect(recall.mock.calls[0]?.[1].text?.length).toBeLessThan(1_200)
  })

  it('keeps a scene selection bounded and prioritises results required by the current step', async () => {
    const base = missionOf('/projects/alpha')
    const earlier: MissionStep = {
      ...base.step,
      id: 'step_earlier',
      state: 'completed',
      result: { value: 1 },
    }
    const needed: MissionStep = {
      ...base.step,
      id: 'step_needed',
      state: 'completed',
      result: { value: 'needed'.repeat(2_000) },
    }
    const step = { ...base.step, dependsOn: [needed.id] }
    const mission = { ...base.mission, plan: { steps: [earlier, needed, step] } }
    const scene = snapshotOf()
    scene.workspace = '3d'
    scene.surface = '3d'
    scene.documents[0] = {
      ...scene.documents[0]!,
      kind: 'scene',
      workspace: '3d',
      path: 'documents/Boat.gltf',
    }
    scene.selection = {
      kind: 'node',
      items: Array.from({ length: 12 }, (_, at) => ({ id: `node_${at}`, name: `Node ${at}` })),
    }
    const builder = createAssistantContextBuilder(dependencies({ snapshot: async () => scene }))
    const context = await builder.build({ mission, step, request: 'Move the selected nodes' })
    expect(context.document?.kind).toBe('scene')
    expect(context.selection?.items).toHaveLength(8)
    expect(context.previousResults[0]?.stepId).toBe('step_needed')
    expect(context.previousResults[0]?.result).toMatchObject({ truncated: true })
    expect(context.budget.results.contentTruncated).toBe(true)
    expect(context.budget.selection.truncated).toBe(true)
  })

  it('ranks relevant project cards before applying their independent budget', async () => {
    const { mission, step } = missionOf('/projects/alpha')
    const cards = Array.from({ length: 9 }, (_, at) => ({
      id: `card_${at}`,
      title: at === 8 ? 'Boat palette' : `Unrelated ${at}`,
      body: 'x'.repeat(120),
      active: true,
      pictures: [],
    }))
    const builder = createAssistantContextBuilder(
      dependencies({ projectContext: { read: async () => ({ cards, trouble: null }) } }),
    )
    const context = await builder.build({ mission, step, request: 'boat colors' })
    expect(context.projectContext?.cards[0]?.id).toBe('card_8')
    expect(context.budget.projectContext.truncated).toBe(true)
  })

  it('captures visual context only when requested and keeps its byte budget independent', async () => {
    const { mission, step } = missionOf('/projects/alpha')
    const capture = vi.fn(async (): Promise<VisualContext> => ({
      kind: 'document',
      mimeType: 'image/png',
      width: 1,
      height: 1,
      bytes: new Uint8Array([1, 2, 3]),
      capturedAt: clock.now(),
    }))
    const builder = createAssistantContextBuilder(dependencies({ visual: capture }))

    expect((await builder.build({ mission, step, request: 'Continue' })).visual).toBeUndefined()
    const context = await builder.build({ mission, step, request: 'Inspect it', visual: true })

    expect(capture).toHaveBeenCalledTimes(1)
    expect(context.visual?.[0]?.bytes).toEqual(new Uint8Array([1, 2, 3]))
    expect(context.budget.visual).toMatchObject({ considered: 1, selected: 1, truncated: false })
  })

  it('drops a visual capture larger than its source budget', async () => {
    const { mission, step } = missionOf('/projects/alpha')
    const builder = createAssistantContextBuilder(
      dependencies({
        visual: async () => ({
          kind: 'document',
          mimeType: 'image/png',
          width: 4_000,
          height: 4_000,
          bytes: new Uint8Array(8_000_001),
          capturedAt: clock.now(),
        }),
      }),
    )

    const context = await builder.build({ mission, step, request: 'Inspect it', visual: true })

    expect(context.visual).toBeUndefined()
    expect(context.budget.visual).toMatchObject({ considered: 1, selected: 0, truncated: true })
  })
})
