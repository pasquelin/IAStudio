import { describe, expect, it, vi } from 'vitest'
import {
  addMissionStep,
  createMission,
  createMissionStep,
  type Mission,
  type MissionStep,
} from '@shared/domain/mission'
import type { Memory, MemoryRecallAsk, MemoryScope } from '@shared/domain/assistantMemory'
import type { ActionResource } from '@shared/domain/assistant'
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
  it('retrieves actions from the mission intent without structural serialization noise', async () => {
    const { mission, step } = missionOf('/projects/alpha')
    const scene = snapshotOf()
    scene.activeDocumentState = {
      documentId: 'document_1',
      kind: 'scene',
      incarnation: 'scene_1',
      revision: 4,
      state: { nodes: Array.from({ length: 20 }, (_, at) => ({ id: `light_${at}` })) },
    }
    scene.selection = { kind: 'node', items: [{ id: 'node_1', name: 'Cube' }] }
    const search = vi.fn(
      async (_query: string, _limit?: number, _available?: readonly ActionResource[]) => [],
    )
    const builder = createAssistantContextBuilder(
      dependencies({ snapshot: async () => scene, actions: { search } }),
    )

    await builder.build({ mission, step, request: 'Rename the selected cube' })

    expect(search).toHaveBeenCalledWith(
      expect.stringContaining('Rename the selected cube'),
      12,
      [],
      { target: 'node', document: 'scene', documentAuthority: 'active' },
    )
    expect(search.mock.calls[0]?.[0]).not.toContain('light_')
  })

  it('does not scope an unrelated request to the current selection', async () => {
    const { mission, step } = missionOf('/projects/alpha')
    const scene = snapshotOf()
    scene.activeDocumentState = {
      documentId: 'document_1',
      kind: 'scene',
      incarnation: 'scene_1',
      revision: 4,
      state: {},
    }
    scene.selection = { kind: 'node', items: [{ id: 'node_1', name: 'Cube' }] }
    const search = vi.fn(
      async (_query: string, _limit?: number, _available?: readonly ActionResource[]) => [],
    )
    const builder = createAssistantContextBuilder(
      dependencies({ snapshot: async () => scene, actions: { search } }),
    )

    await builder.build({ mission, step, request: 'List project scripts' })

    expect(search).toHaveBeenCalledWith('Create a project image\nList project scripts', 12, [], {
      document: 'scene',
      documentAuthority: 'active',
    })
  })

  it('only exposes resources returned with a non-empty result', async () => {
    const base = missionOf('/projects/alpha')
    const discovered: MissionStep = {
      ...base.step,
      id: 'step_search',
      kind: 'action',
      call: { action: 'models.search', input: { query: '3d' } },
      state: 'completed',
      result: [],
    }
    const search = vi.fn(
      async (_query: string, _limit?: number, _available?: readonly ActionResource[]) => [],
    )
    const builder = createAssistantContextBuilder(dependencies({ actions: { search } }))
    await builder.build({
      mission: { ...base.mission, plan: { steps: [discovered, base.step] } },
      step: base.step,
      request: 'Generate an image',
    })
    await builder.build({
      mission: {
        ...base.mission,
        plan: { steps: [{ ...discovered, result: [{ id: 'model-3d' }] }, base.step] },
      },
      step: base.step,
      request: 'Generate an image',
    })

    expect(search.mock.calls.map(call => call[2])).toEqual([[], ['generationModelCandidates']])
  })
  it('exposes generated assets after a completed job', async () => {
    const base = missionOf('/projects/alpha')
    const completedJob: MissionStep = {
      ...base.step,
      id: 'step_job',
      kind: 'job',
      jobId: 'job_1',
      state: 'completed',
      result: { id: 'job_1', assetIds: ['asset_1'] },
    }
    const search = vi.fn(
      async (_query: string, _limit?: number, _available?: readonly ActionResource[]) => [],
    )
    const builder = createAssistantContextBuilder(dependencies({ actions: { search } }))
    await builder.build({
      mission: { ...base.mission, plan: { steps: [completedJob, base.step] } },
      step: base.step,
      request: 'Add the generated result to the timeline',
    })
    expect(search.mock.calls[0]?.[2]).toEqual(['projectAssetCandidates'])
  })

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
    expect(context.workspace?.documents).toEqual([
      { id: 'document_1', title: 'Boat', kind: 'image', active: true },
    ])
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

  it('includes active studio jobs even when the mission is not waiting for them', async () => {
    const { mission, step } = missionOf('/projects/alpha')
    const completed: Job = { ...job, id: 'job_done', status: 'succeeded' }
    const builder = createAssistantContextBuilder(
      dependencies({ jobs: { list: () => [completed, job] } }),
    )

    const context = await builder.build({ mission, step, request: 'Cancel the running generation' })

    expect(context.jobs).toEqual([job])
  })

  it('prioritises mission jobs when active studio jobs fill the source budget', async () => {
    const base = missionOf('/projects/alpha')
    const waiting = addMissionStep(
      base.mission,
      createMissionStep(
        base.mission.id,
        'Wait',
        { kind: 'job', jobId: 'job_linked' },
        { ...clock, newId: () => 'linked' },
      ),
      clock.now(),
    )
    const active = Array.from({ length: 6 }, (_, at): Job => ({
      ...job,
      id: `job_active_${at}`,
    }))
    const linked: Job = { ...job, id: 'job_linked' }
    const builder = createAssistantContextBuilder(
      dependencies({ jobs: { list: () => [...active, linked] } }),
    )

    const context = await builder.build({ mission: waiting, step: base.step, request: 'Continue' })

    expect(context.jobs[0]?.id).toBe('job_linked')
    expect(context.jobs).toHaveLength(6)
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
    expect(context.jobs).toEqual([])
    expect(context.document).toBeUndefined()
    expect(context.project).toBeNull()
    expect(recall).toHaveBeenCalledTimes(1)
    expect(recall).toHaveBeenCalledWith('global', expect.anything())
    expect(readContext).not.toHaveBeenCalled()
  })

  it('keeps workspace state when open documents exhaust the remaining budget', async () => {
    const { mission, step } = missionOf('/projects/alpha')
    const snapshot = snapshotOf('/projects/alpha')
    const document = snapshot.documents[0]
    if (!document) throw new Error('snapshot fixture needs one document')
    snapshot.documents = Array.from({ length: 8 }, (_, at) => ({
      ...document,
      id: `document_${at}`,
      title: `Document ${at} ${'x'.repeat(80)}`,
      active: at === 0,
    }))
    const builder = createAssistantContextBuilder(dependencies({ snapshot: async () => snapshot }))

    const context = await builder.build({ mission, step, request: 'Inspect the workspace' })

    expect(context.workspace).toMatchObject({ workspace: 'image', surface: 'image' })
    expect(context.workspace?.documents.length).toBeLessThan(8)
    expect(context.budget.workspace).toMatchObject({ truncated: true, contentTruncated: true })
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
        relevanceScore: 8 - at,
        applicabilityScore: 0,
        documentAffinity: 'transversal',
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
