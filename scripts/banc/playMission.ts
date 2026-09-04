import type { AssistantCall } from '@shared/domain/assistant'
import type { Mission, MissionClock } from '@shared/domain/mission'
import type { StudioSnapshot } from '@shared/domain/studioSnapshot'
import type { ActionSearchService } from '@main/actionIndex/actionSearchService'
import type { AssistantBrain } from '@main/assistant/brainPort'
import { createAssistantContextBuilder } from '@main/mission/contextBuilder'
import { createStudioEventBus } from '@main/mission/eventBus'
import type { MissionJournal } from '@main/mission/journal'
import { createMissionManager } from '@main/mission/manager'
import { createMissionMetrics, type MissionRuntimeMetrics } from '@main/mission/metrics'
import { createMissionRuntime } from '@main/mission/runtime'
import { createMissionStore } from '@main/mission/store'
import { PROJECT, WHEN } from './project'
import type { Called, Run, Scenario } from './run'
import { createStudio, type Think } from './studio'

export type MissionRun = Run & { rounds: number; metrics: MissionRuntimeMetrics }

function clock(): MissionClock {
  let sequence = 0
  return {
    now: () => new Date().toISOString(),
    newId: () => `${Date.now()}_${(sequence += 1)}`,
  }
}

const memoryJournal = (): MissionJournal => ({
  read: async () => [],
  append: async () => {},
  flush: async () => {},
})

async function snapshotOf(
  studio: Awaited<ReturnType<typeof createStudio>>,
): Promise<StudioSnapshot> {
  const active = studio.front()
  const state = await studio.state()
  return {
    project: {
      path: `/bench/${studio.projectName()}`,
      manifest: { version: 1, createdAt: WHEN, updatedAt: WHEN },
    },
    projectKnown: true,
    workspace: active?.workspace ?? 'image',
    surface: active?.workspace ?? 'image',
    commandScope: null,
    documents: studio.documents().map(document => ({
      ...document,
      active: document.id === active?.id,
      modified: false,
    })),
    ...(active
      ? {
          activeDocumentState: {
            documentId: active.id,
            kind: active.kind,
            incarnation: active.id,
            revision: 0,
            state,
          },
        }
      : {}),
    selection: null,
    armedModels: {},
    play: studio.playState(),
    tasks: [],
    authenticated: true,
    authKnown: true,
  }
}

const answersOf = (missions: readonly Mission[]): { said: string; asks: readonly string[] } => {
  const answers = missions.flatMap(mission =>
    mission.plan.steps.flatMap(step =>
      typeof step.result === 'object' && step.result !== null ? [step.result] : [],
    ),
  )
  return {
    said: answers
      .flatMap(answer => ('say' in answer && typeof answer.say === 'string' ? [answer.say] : []))
      .join('\n'),
    asks: answers.flatMap(answer => {
      if (!('ask' in answer) || typeof answer.ask !== 'object' || answer.ask === null) return []
      if (!('questions' in answer.ask) || !Array.isArray(answer.ask.questions)) return []
      return answer.ask.questions.flatMap(question =>
        typeof question === 'object' &&
        question !== null &&
        'question' in question &&
        typeof question.question === 'string'
          ? [question.question]
          : [],
      )
    }),
  }
}

export async function playMission(
  scenario: Scenario,
  think: Think,
  actions: Pick<ActionSearchService, 'search'>,
): Promise<MissionRun> {
  const called: Called[] = []
  const metrics = createMissionMetrics()
  const studio = await createStudio(PROJECT, undefined, scenario.answers)
  const time = clock()
  const manager = createMissionManager(
    createMissionStore(memoryJournal()),
    createStudioEventBus(),
    time,
  )
  const brain: AssistantBrain = {
    capabilities: async () => ({
      streaming: false,
      structuredJson: true,
      multimodalImages: false,
    }),
    window: async () => null,
    think: async request => await think(request),
  }
  const context = createAssistantContextBuilder({
    snapshot: async () => await snapshotOf(studio),
    actions,
    memories: { recall: async () => studio.memories() },
    jobs: { list: () => [...studio.jobs()] },
    projectContext: { read: async () => studio.projectContext() },
  })
  const runtime = createMissionRuntime({
    manager,
    context,
    brain,
    actions: {
      run: async (call: AssistantCall) => {
        const outcome = await studio.run(call.action, call.input)
        called.push({
          action: call.action,
          input: call.input,
          answer: outcome.ok
            ? outcome.data === undefined
              ? 'ok'
              : `ok ${JSON.stringify(outcome.data)}`
            : `refused ${outcome.refusal}`,
        })
        return outcome
      },
      settle: () => {},
    },
    jobs: { list: () => [...studio.jobs()] },
    revisions: { read: async () => ({ current: [], unavailable: [] }) },
    clock: time,
    metrics,
  })

  try {
    await scenario.setup?.(studio)
    studio.settle()
    for (const request of scenario.said) await runtime.create(request, {})
    const response = answersOf(await manager.list({}))
    return {
      studio,
      called,
      refused: called.filter(call => call.answer?.startsWith('refused')).length,
      said: response.said,
      asks: response.asks,
      rounds: metrics.read().llmCalls,
      metrics: metrics.read(),
    }
  } catch (error) {
    studio.close()
    throw error
  }
}
