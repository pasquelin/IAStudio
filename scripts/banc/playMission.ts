import {
  MOST_QUESTIONS,
  type ActionName,
  type ActionOutcome,
  type AssistantCall,
} from '@shared/domain/assistant'
import { MEMORY_ANSWERING_STATES } from '@shared/domain/assistantMemory'
import type { Mission, MissionClock } from '@shared/domain/mission'
import type { StudioSnapshot } from '@shared/domain/studioSnapshot'
import { actionSearchScope } from '@main/actionIndex/actionSearchContext'
import { foundActionsData, type ActionSearchService } from '@main/actionIndex/actionSearchService'
import type { AssistantBrain } from '@main/assistant/brainPort'
import {
  createAssistantContextBuilder,
  type AssistantContextBuilder,
} from '@main/mission/contextBuilder'
import { createStudioEventBus } from '@main/mission/eventBus'
import type { MissionJournal } from '@main/mission/journal'
import { createMissionManager, type MissionManager } from '@main/mission/manager'
import { createMissionMetrics, type MissionRuntimeMetrics } from '@main/mission/metrics'
import { createMissionRuntime } from '@main/mission/runtime'
import { createMissionRevisionReader } from '@main/mission/resourceState'
import { createMissionStore } from '@main/mission/store'
import { PROJECT } from './project'
import type { Called, Run, Scenario } from './run'
import { createStudio } from './studio'
import type { Studio } from './studioContract'
import { createMissionTraceRecorder, type MissionTraceRecorder } from './missionTrace'

export type MissionRun = Run & {
  rounds: number
  metrics: MissionRuntimeMetrics
  /** Every action any reflection offered the model — what the retrieval is judged on. */
  candidates: readonly ActionName[]
  missions: readonly Mission[]
  traceFile?: string
}

type MissionTraceOptions = { folder: string; scenarioId: string; runId: number }

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

/**
 * What `createRoutedBrain` adds in the product before any door — the state in front and the
 * memory count. Filled here as `play.ts` fills them: a bench that omitted them measured a
 * briefing the studio never sends.
 */
function tracedBrain(
  think: AssistantBrain['think'],
  recorder: MissionTraceRecorder | null,
  studio: Studio,
): AssistantBrain {
  return {
    capabilities: async () => ({ streaming: false, structuredJson: true, multimodalImages: false }),
    window: async () => null,
    think: async (packed, watch) => {
      const request = {
        ...packed,
        state: await studio.state(),
        memories: studio.memories().filter(memory => MEMORY_ANSWERING_STATES.includes(memory.state))
          .length,
      }
      const reflection = recorder?.beginReflection(request)
      try {
        const answer = await think(request, {
          ...watch,
          onNote: note => {
            if (reflection) recorder?.note(reflection, note)
            watch?.onNote?.(note)
          },
        })
        if (reflection) recorder?.completeReflection(reflection, answer)
        return answer
      } catch (error) {
        if (reflection) recorder?.failReflection(reflection, error)
        throw error
      }
    },
  }
}

function tracedContext(
  studio: Studio,
  actions: Pick<ActionSearchService, 'search'>,
  recorder: MissionTraceRecorder | null,
  offered: Set<ActionName>,
): AssistantContextBuilder {
  let snapshot: StudioSnapshot | null = null
  let retrieval: {
    query: string
    available: NonNullable<Parameters<typeof actions.search>[2]>
    scope: NonNullable<Parameters<typeof actions.search>[3]>
    candidates: Awaited<ReturnType<typeof actions.search>>
  } = {
    query: '',
    available: [],
    scope: {} as NonNullable<Parameters<typeof actions.search>[3]>,
    candidates: [] as Awaited<ReturnType<typeof actions.search>>,
  }
  const builder = createAssistantContextBuilder({
    snapshot: async () => (snapshot = await studio.snapshot()),
    actions: {
      search: async (query, limit, available, scope) => {
        const candidates = await actions.search(query, limit, available, scope)
        for (const hit of candidates) offered.add(hit.action.name)
        retrieval = { query, available: available ?? [], scope: scope ?? {}, candidates }
        return candidates
      },
    },
    memories: { recall: async () => studio.memories() },
    jobs: { list: () => [...studio.jobs()] },
    projectContext: { read: async () => studio.projectContext() },
  })
  return {
    build: async request => {
      const context = await builder.build(request)
      recorder?.context(request.mission.id, request.step.id, { ...retrieval, snapshot })
      return context
    },
    searchActions: builder.searchActions,
  }
}

/**
 * `actions.find` goes to the index, as `createRemoteActions` sends it in the product. Left to the
 * studio it ran the window's `findActions` — English names alone, a second search engine the
 * bench measured without knowing.
 */
async function foundActions(
  studio: Studio,
  actions: Pick<ActionSearchService, 'search'>,
  input: Record<string, unknown>,
): Promise<ActionOutcome> {
  const query = input['query']
  if (typeof query !== 'string') return { ok: false, refusal: 'badInput' }
  const scope = actionSearchScope(await studio.snapshot(), query)
  return { ok: true, data: foundActionsData(await actions.search(query, 12, undefined, scope)) }
}

function tracedActions(
  studio: Studio,
  actions: Pick<ActionSearchService, 'search'>,
  called: Called[],
  recorder: MissionTraceRecorder | null,
) {
  return {
    run: async (call: AssistantCall) => {
      let outcome
      try {
        outcome =
          call.action === 'actions.find'
            ? await foundActions(studio, actions, call.input)
            : await studio.run(call.action, call.input)
      } catch (error) {
        recorder?.actionError(call, error)
        throw error
      }
      recorder?.action(call, outcome)
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
  }
}

async function projectScope(studio: Studio): Promise<{ projectId?: string }> {
  const projectId = (await studio.snapshot()).project?.path
  return projectId ? { projectId } : {}
}

async function writeFailure(
  recorder: MissionTraceRecorder | null,
  manager: ReturnType<typeof createMissionManager>,
  studio: Studio,
): Promise<void> {
  if (!recorder) return
  try {
    recorder.write(await manager.list({}), await studio.snapshot())
  } catch {
    recorder.write([])
  }
}

function completedRun(
  studio: Studio,
  called: readonly Called[],
  metrics: ReturnType<typeof createMissionMetrics>,
  missions: readonly Mission[],
  candidates: ReadonlySet<ActionName>,
  traceFile?: string,
): MissionRun {
  const response = answersOf(missions)
  return {
    studio,
    called,
    refused: called.filter(call => call.answer?.startsWith('refused')).length,
    said: response.said,
    asks: response.asks,
    rounds: metrics.read().llmCalls,
    metrics: metrics.read(),
    candidates: [...candidates],
    missions,
    ...(traceFile ? { traceFile } : {}),
  }
}

/**
 * The person answering the model's questions, one scripted reply per question. Bounded as the
 * answer format is: a mission that asks more than that is asking in circles.
 */
async function answerQuestions(
  runtime: ReturnType<typeof createMissionRuntime>,
  manager: MissionManager,
  mission: Mission,
  replies: readonly string[],
): Promise<void> {
  let current = mission
  const pending = [...replies]
  for (let asked = 0; asked < MOST_QUESTIONS; asked += 1) {
    const wait = current.waits.find(one => one.kind === 'user')
    const reply = pending.shift()
    if (!wait || reply === undefined) return
    await runtime.scheduler.resume(current.id, wait.stepId, reply)
    current = (await manager.read(current.id)) ?? current
  }
}

export async function playMission(
  scenario: Scenario,
  think: AssistantBrain['think'],
  actions: Pick<ActionSearchService, 'search'>,
  traceOptions?: MissionTraceOptions,
): Promise<MissionRun> {
  const called: Called[] = [],
    metrics = createMissionMetrics(),
    offered = new Set<ActionName>()
  const studio = await createStudio(PROJECT, undefined, scenario.answers)
  const recorder = traceOptions
    ? createMissionTraceRecorder({ ...traceOptions, userRequest: scenario.said })
    : null
  const time = clock()
  const manager = createMissionManager(
    createMissionStore(memoryJournal()),
    createStudioEventBus(),
    time,
  )
  const runtime = createMissionRuntime({
    manager,
    context: tracedContext(studio, actions, recorder, offered),
    brain: tracedBrain(think, recorder, studio),
    actions: tracedActions(studio, actions, called, recorder),
    jobs: { list: () => [...studio.jobs()] },
    revisions: createMissionRevisionReader(async () => await studio.snapshot()),
    clock: time,
    metrics,
  })

  try {
    await scenario.setup?.(studio)
    studio.settle()
    const scope = await projectScope(studio)
    for (const request of scenario.said) {
      const mission = await runtime.create(request, scope)
      if (scenario.replies) await answerQuestions(runtime, manager, mission, scenario.replies)
    }
    const missions = await manager.list(scope)
    const traceFile = recorder?.write(missions, await studio.snapshot())
    return completedRun(studio, called, metrics, missions, offered, traceFile)
  } catch (error) {
    await writeFailure(recorder, manager, studio)
    studio.close()
    throw error
  }
}
