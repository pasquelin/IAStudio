import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getLlama } from 'node-llama-cpp'
import {
  createActionIndex,
  type ActionIndex,
  type ActionRanking,
} from '@main/actionIndex/actionIndex'
import { actionCorpus, actionFingerprint, type ActionCorpus } from '@main/actionIndex/actionCorpus'
import { actionSearchScope, availableActionTargets } from '@main/actionIndex/actionSearchContext'
import { normalised } from '@main/memory/vectors'
import { openMemoryDatabase } from '@main/project/sqliteMemory'
import type { ActionName } from '@shared/domain/assistant'
import { expectedMissionActions } from './missionCatalogue'
import { PROJECT } from './project'
import { SCENARIOS } from './scenarios'
import { CONTROL_CASES, DIFFICULT_SCENARIOS } from './semanticActionSearchCases'
import { createStudio } from './studio'

const MODEL_PATH = process.env['SEMANTIC_ACTION_MODEL']
const OUTPUT = process.env['SEMANTIC_ACTION_OUTPUT'] ?? '.agents/loop-todo'
const MODEL_ID = 'intfloat/multilingual-e5-small@fd1525a-q8_0'
const RRF_K = 60

type Variant = 'algorithmic' | 'semantic' | 'rrf' | 'hybrid'
type Representation = 'short' | 'business'

const REPRESENTATIONS: readonly Representation[] = ['short', 'business']
const VARIANTS: readonly Variant[] = ['algorithmic', 'semantic', 'rrf', 'hybrid']
type CaseResult = {
  scenarioId: string
  request: string
  expectedAction: ActionName
  global: boolean
  difficult: boolean
  control: boolean
  ranks: Record<Variant, number>
  semanticScore: number
  top12: Record<Variant, readonly ActionName[]>
}

type Metrics = {
  evaluations: number
  recallAt1: number
  recallAt3: number
  recallAt5: number
  recallAt12: number
  mrr: number
  meanRank: number
}

type Llama = Awaited<ReturnType<typeof getLlama>>
type Model = Awaited<ReturnType<Llama['loadModel']>>
type EmbeddingContext = Awaited<ReturnType<Model['createEmbeddingContext']>>
type Scenario = (typeof SCENARIOS)[number]
type Report = {
  representation: Representation
  results: readonly CaseResult[]
  timings: object
}
type LoadedRuntime = {
  llama: Llama
  model: Model
  context: EmbeddingContext
  loadMilliseconds: number
  rssBefore: number
  rssLoaded: number
}

const scenarioIdOf = (name: string): string => name.split(' ')[0] ?? name

function shortText(action: ActionCorpus['actions'][number]): string {
  return [
    action.name,
    action.family,
    ...action.localizedTitles,
    ...(action.capabilities.targets ?? []),
    ...(action.capabilities.intents ?? []),
  ].join(' ')
}

function businessText(action: ActionCorpus['actions'][number]): string {
  return [
    action.searchable,
    ...(action.capabilities.documentKinds ?? []),
    action.capabilities.documentAffinity ?? 'transversal',
    ...action.requires,
    ...action.produces,
    ...action.inputs,
    ...action.uses,
    ...action.returns,
  ].join(' ')
}

function represented(corpus: ActionCorpus, representation: Representation): ActionCorpus {
  const actions = corpus.actions.map(action => ({
    ...action,
    searchable: representation === 'short' ? shortText(action) : businessText(action),
  }))
  return { actions, fingerprint: actionFingerprint(actions) }
}

function metricsOf(results: readonly CaseResult[], variant: Variant): Metrics {
  const ranks = results.map(result => result.ranks[variant])
  const recall = (limit: number): number =>
    ranks.filter(rank => rank <= limit).length / ranks.length
  return {
    evaluations: ranks.length,
    recallAt1: recall(1),
    recallAt3: recall(3),
    recallAt5: recall(5),
    recallAt12: recall(12),
    mrr: ranks.reduce((sum, rank) => sum + 1 / rank, 0) / ranks.length,
    meanRank: ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length,
  }
}

function namesOf(ranking: readonly ActionRanking[]): readonly ActionName[] {
  return ranking
    .filter(hit => hit.action.name !== 'actions.find')
    .slice(0, 12)
    .map(hit => hit.action.name)
}

function rankMap(ranking: readonly ActionRanking[]): Map<ActionName, number> {
  return new Map(ranking.map(hit => [hit.action.name, hit.rank]))
}

function semanticRanking(ranking: readonly ActionRanking[]): readonly ActionRanking[] {
  const candidates = ranking
    .filter(hit => hit.action.name !== 'actions.find')
    .sort(
      (left, right) =>
        (right.semanticScore ?? -1) - (left.semanticScore ?? -1) ||
        left.action.ordinal - right.action.ordinal,
    )
  return [...candidates, ...ranking.filter(hit => hit.action.name === 'actions.find')]
}

function rrfRanking(
  algorithmic: readonly ActionRanking[],
  semantic: readonly ActionRanking[],
  algorithmicWeight: number,
): readonly ActionRanking[] {
  const algorithmicRanks = rankMap(algorithmic)
  const semanticRanks = new Map(semantic.map((hit, index) => [hit.action.name, index + 1]))
  const candidates = algorithmic
    .filter(hit => hit.action.name !== 'actions.find')
    .sort((left, right) => {
      const score = (action: ActionName): number =>
        algorithmicWeight / (RRF_K + (algorithmicRanks.get(action) ?? algorithmic.length)) +
        1 / (RRF_K + (semanticRanks.get(action) ?? semantic.length))
      return (
        score(right.action.name) - score(left.action.name) ||
        left.action.ordinal - right.action.ordinal
      )
    })
  return [...candidates, ...algorithmic.filter(hit => hit.action.name === 'actions.find')]
}

function positionOf(ranking: readonly ActionRanking[], action: ActionName): number {
  const position = ranking.findIndex(hit => hit.action.name === action)
  return position < 0 ? ranking.length + 1 : position + 1
}

function actionRankOf(ranking: readonly ActionRanking[], action: ActionName): number {
  return ranking.find(hit => hit.action.name === action)?.rank ?? ranking.length + 1
}

function boundedPassage(model: Model, text: string): string {
  const passage = `passage: ${text}`
  const tokens = model.tokenize(passage)
  return tokens.length <= 500 ? passage : model.detokenize(tokens.slice(0, 500))
}

async function embeddedCorpus(
  context: EmbeddingContext,
  model: Model,
  representation: Representation,
): Promise<readonly { name: ActionName; model: string; values: Float32Array }[]> {
  const embeddings = []
  for (const action of represented(actionCorpus(), representation).actions) {
    const answer = await context.getEmbeddingFor(boundedPassage(model, action.searchable))
    embeddings.push({
      name: action.name,
      model: MODEL_ID,
      values: normalised(Float32Array.from(answer.vector)),
    })
  }
  return embeddings
}

function resultOf(
  scenario: Scenario,
  expectedAction: ActionName,
  algorithmic: readonly ActionRanking[],
  semantic: readonly ActionRanking[],
  rrf: readonly ActionRanking[],
  hybrid: readonly ActionRanking[],
): CaseResult | null {
  const algorithmicRank = actionRankOf(algorithmic, expectedAction)
  const difficult = DIFFICULT_SCENARIOS.has(scenarioIdOf(scenario.name)) && algorithmicRank > 12
  if (expectedMissionActions(scenario).length !== 1 && !difficult) return null
  const expected = semantic.find(hit => hit.action.name === expectedAction)
  if (!expected) throw new Error(`${expectedAction} is absent from the corpus`)
  return {
    scenarioId: scenarioIdOf(scenario.name),
    request: scenario.said.join('\n'),
    expectedAction,
    global: expectedMissionActions(scenario).length === 1,
    difficult,
    control: false,
    ranks: {
      algorithmic: algorithmicRank,
      semantic: positionOf(semantic, expectedAction),
      rrf: positionOf(rrf, expectedAction),
      hybrid: positionOf(hybrid, expectedAction),
    },
    semanticScore: expected.semanticScore ?? 0,
    top12: {
      algorithmic: namesOf(algorithmic),
      semantic: namesOf(semantic),
      rrf: namesOf(rrf),
      hybrid: namesOf(hybrid),
    },
  }
}

async function evaluateControl(
  index: ActionIndex,
  context: EmbeddingContext,
  request: string,
  expectedAction: ActionName,
): Promise<CaseResult> {
  const algorithmic = index.inspect({ query: `${request}\nPlan mission`, limit: 12 })
  const query = normalised(
    Float32Array.from((await context.getEmbeddingFor(`query: ${request}`)).vector),
  )
  const semantic = semanticRanking(
    index.inspect({
      query: `${request}\nPlan mission`,
      limit: 12,
      embedding: { model: MODEL_ID, values: query },
    }),
  )
  const rrf = rrfRanking(algorithmic, semantic, 1)
  const hybrid = rrfRanking(algorithmic, semantic, 2)
  const expected = semantic.find(hit => hit.action.name === expectedAction)
  if (!expected) throw new Error(`${expectedAction} is absent from the corpus`)
  return {
    scenarioId: request,
    request,
    expectedAction,
    global: false,
    difficult: false,
    control: true,
    ranks: {
      algorithmic: actionRankOf(algorithmic, expectedAction),
      semantic: positionOf(semantic, expectedAction),
      rrf: positionOf(rrf, expectedAction),
      hybrid: positionOf(hybrid, expectedAction),
    },
    semanticScore: expected.semanticScore ?? 0,
    top12: {
      algorithmic: namesOf(algorithmic),
      semantic: namesOf(semantic),
      rrf: namesOf(rrf),
      hybrid: namesOf(hybrid),
    },
  }
}

async function evaluateScenario(
  index: ActionIndex,
  context: EmbeddingContext,
  scenario: Scenario,
): Promise<{
  results: readonly CaseResult[]
  queryMilliseconds: number
  searchMilliseconds: number
}> {
  const expectedActions = expectedMissionActions(scenario)
  if (expectedActions.length !== 1 && !DIFFICULT_SCENARIOS.has(scenarioIdOf(scenario.name)))
    return { results: [], queryMilliseconds: 0, searchMilliseconds: 0 }
  const request = scenario.said.join('\n')
  const studio = await createStudio(PROJECT)
  try {
    await scenario.setup?.(studio)
    studio.settle()
    const scope = actionSearchScope(
      await studio.snapshot(),
      request,
      availableActionTargets(studio.projectContext(), request),
    )
    const algorithmic = index.inspect({ query: `${request}\nPlan mission`, limit: 12, scope })
    const started = performance.now()
    const query = normalised(
      Float32Array.from((await context.getEmbeddingFor(`query: ${request}`)).vector),
    )
    const queryMilliseconds = performance.now() - started
    const searchStarted = performance.now()
    const semantic = semanticRanking(
      index.inspect({
        query: `${request}\nPlan mission`,
        limit: 12,
        scope,
        embedding: { model: MODEL_ID, values: query },
      }),
    )
    const searchMilliseconds = performance.now() - searchStarted
    const rrf = rrfRanking(algorithmic, semantic, 1)
    const hybrid = rrfRanking(algorithmic, semantic, 2)
    return {
      queryMilliseconds,
      searchMilliseconds,
      results: expectedActions.flatMap(action => {
        const result = resultOf(scenario, action, algorithmic, semantic, rrf, hybrid)
        return result ? [result] : []
      }),
    }
  } finally {
    studio.close()
  }
}

async function loadRuntime(): Promise<LoadedRuntime> {
  if (!MODEL_PATH) throw new Error('SEMANTIC_ACTION_MODEL is required')
  const rssBefore = process.memoryUsage.rss()
  const started = performance.now()
  const llama = await getLlama({ gpu: false })
  const model = await llama.loadModel({ modelPath: MODEL_PATH })
  const context = await model.createEmbeddingContext({ contextSize: { max: 511 } })
  return {
    llama,
    model,
    context,
    loadMilliseconds: performance.now() - started,
    rssBefore,
    rssLoaded: process.memoryUsage.rss(),
  }
}

async function measureCases(index: ActionIndex, context: EmbeddingContext) {
  const results: CaseResult[] = []
  const queryTimes: number[] = []
  const searchTimes: number[] = []
  for (const scenario of SCENARIOS) {
    const measured = await evaluateScenario(index, context, scenario)
    results.push(...measured.results)
    if (measured.queryMilliseconds > 0) queryTimes.push(measured.queryMilliseconds)
    if (measured.searchMilliseconds > 0) searchTimes.push(measured.searchMilliseconds)
  }
  for (const sample of CONTROL_CASES)
    results.push(await evaluateControl(index, context, sample.request, sample.expectedAction))
  return { results, queryTimes, searchTimes }
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length * fraction)] ?? 0
}

async function disposeRuntime(runtime: LoadedRuntime, index: ActionIndex): Promise<void> {
  index.close()
  await runtime.context.dispose()
  await runtime.model.dispose()
  await runtime.llama.dispose()
}

async function measureRepresentation(representation: Representation): Promise<Report> {
  const runtime = await loadRuntime()
  const index = createActionIndex(openMemoryDatabase())
  index.rebuild(actionCorpus())
  const corpusStarted = performance.now()
  index.writeEmbeddings(await embeddedCorpus(runtime.context, runtime.model, representation))
  const corpusMilliseconds = performance.now() - corpusStarted
  const rssAfterCorpus = process.memoryUsage.rss()
  const measured = await measureCases(index, runtime.context)
  const report = {
    representation,
    results: measured.results,
    timings: {
      loadMilliseconds: runtime.loadMilliseconds,
      corpusMilliseconds,
      warmQueryP50Milliseconds: percentile(measured.queryTimes, 0.5),
      warmQueryP95Milliseconds: percentile(measured.queryTimes, 0.95),
      vectorSearchP50Milliseconds: percentile(measured.searchTimes, 0.5),
      vectorSearchP95Milliseconds: percentile(measured.searchTimes, 0.95),
      rssBefore: runtime.rssBefore,
      rssLoaded: runtime.rssLoaded,
      rssAfterCorpus,
    },
  }
  await disposeRuntime(runtime, index)
  return report
}

describe.skipIf(MODEL_PATH === undefined)('semantic Action Search spike', () => {
  const reports: Report[] = []

  for (const representation of REPRESENTATIONS)
    it(`measures ${representation} action representations`, async () => {
      const report = await measureRepresentation(representation)
      reports.push(report)
      const { results } = report
      expect(results.filter(result => result.global)).toHaveLength(414)
      expect(results.filter(result => result.difficult)).toHaveLength(50)
      expect(results.filter(result => result.control)).toHaveLength(12)
    }, 180_000)

  afterAll(() => {
    if (reports.length === 0) return
    const output = reports.map(report => {
      const global = report.results.filter(result => result.global)
      const difficult = report.results.filter(result => result.difficult)
      const control = report.results.filter(result => result.control)
      return {
        ...report,
        metrics: Object.fromEntries(
          VARIANTS.map(variant => [
            variant,
            {
              global: metricsOf(global, variant),
              difficult: metricsOf(difficult, variant),
              control: metricsOf(control, variant),
            },
          ]),
        ),
      }
    })
    mkdirSync(OUTPUT, { recursive: true })
    writeFileSync(
      join(OUTPUT, 'semantic-action-search-results.json'),
      `${JSON.stringify({ model: MODEL_ID, reports: output }, null, 2)}\n`,
    )
  })
})
