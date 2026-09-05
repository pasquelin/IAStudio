import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const output = process.env.SEMANTIC_ACTION_OUTPUT ?? '.agents/loop-todo'
const source = JSON.parse(readFileSync(join(output, 'semantic-deep-diagnostic.json'), 'utf8'))

const paraphrases = new Set([
  '5.5',
  '6.12',
  '9.6',
  '10.6',
  '15.6',
  '17.2',
  '17.3',
  '17.4',
  '21.2',
  '24.5',
  '39.2',
  '43.1',
  '46.1',
  '48.2',
  '51.8',
  '54.5',
])
const collisions = new Set([
  '6.8',
  '12.6',
  '14.1',
  '14.3',
  '15.5',
  '18.1',
  '22.4',
  '23.3',
  '24.2',
  '24.4',
  '24.9',
  '33.1',
  '42.2',
  '44.4',
  '46.4',
])

function categoryOf(result) {
  if (paraphrases.has(result.scenarioId)) return 'PARAPHRASE'
  if (collisions.has(result.scenarioId)) return 'DOMAIN_COLLISION'
  return 'OTHER_DIFFICULT'
}

function mean(values) {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length
}

function standardDeviation(values) {
  const average = mean(values)
  return Math.sqrt(mean(values.map(value => (value - average) ** 2)))
}

function metrics(results) {
  const ranks = results.map(result => result.ranks.semantic)
  const recall = limit => ranks.filter(rank => rank <= limit).length / Math.max(1, ranks.length)
  return {
    evaluations: results.length,
    recallAt1: recall(1),
    recallAt3: recall(3),
    recallAt5: recall(5),
    recallAt12: recall(12),
    mrr: mean(ranks.map(rank => 1 / rank)),
  }
}

function concentration(results) {
  const top1 = results.map(result => result.semanticTop50[0]?.cosine ?? 0)
  const expected = results.map(result => result.semanticScore)
  const top12 = results.map(result => result.semanticTop50[11]?.cosine ?? 0)
  const allTop50 = results.flatMap(result =>
    result.semanticTop50.map(candidate => candidate.cosine),
  )
  return {
    top1Mean: mean(top1),
    expectedMean: mean(expected),
    top1ExpectedGapMean: mean(top1.map((value, index) => value - (expected[index] ?? 0))),
    top1Top12GapMean: mean(top1.map((value, index) => value - (top12[index] ?? 0))),
    top50StandardDeviation: standardDeviation(allTop50),
  }
}

function rate(results, rankOf) {
  return {
    evaluations: results.length,
    recallAt1: results.filter(result => rankOf(result) <= 1).length / Math.max(1, results.length),
    recallAt3: results.filter(result => rankOf(result) <= 3).length / Math.max(1, results.length),
    recallAt5: results.filter(result => rankOf(result) <= 5).length / Math.max(1, results.length),
    recallAt12: results.filter(result => rankOf(result) <= 12).length / Math.max(1, results.length),
  }
}

const reports = Object.fromEntries(source.reports.map(report => [report.representation, report]))
const business = reports.business
const compact = reports.compact
const difficult = business.results.filter(result => result.difficult)
const categoryResults = Object.fromEntries(
  ['PARAPHRASE', 'DOMAIN_COLLISION', 'OTHER_DIFFICULT'].map(category => [
    category,
    difficult.filter(result => categoryOf(result) === category),
  ]),
)
const classification = {
  semanticFailure: difficult.filter(
    result => result.ranks.semantic > 12 && result.ranks.hybrid > 12,
  ),
  fusionFailure: difficult.filter(
    result => result.ranks.semantic <= 12 && result.ranks.hybrid > 12,
  ),
  algorithmicRescue: difficult.filter(
    result => result.ranks.semantic > 12 && result.ranks.hybrid <= 12,
  ),
  semanticSuccess: difficult.filter(
    result => result.ranks.semantic <= 12 && result.ranks.hybrid <= 12,
  ),
}
const representationMetrics = Object.fromEntries(
  Object.entries(reports).map(([representation, report]) => [
    representation,
    Object.fromEntries(
      Object.entries(categoryResults).map(([category, cases]) => [
        category,
        metrics(
          report.results.filter(result =>
            cases.some(
              candidate =>
                candidate.scenarioId === result.scenarioId &&
                candidate.expectedAction === result.expectedAction,
            ),
          ),
        ),
      ]),
    ),
  ]),
)
const compactByKey = new Map(
  compact.results
    .filter(result => result.difficult)
    .map(result => [`${result.scenarioId}/${result.expectedAction}`, result]),
)
const representationDiff = difficult.map(result => {
  const compactResult = compactByKey.get(`${result.scenarioId}/${result.expectedAction}`)
  return {
    scenarioId: result.scenarioId,
    expectedAction: result.expectedAction,
    businessRank: result.ranks.semantic,
    compactRank: compactResult?.ranks.semantic ?? 0,
    delta: result.ranks.semantic - (compactResult?.ranks.semantic ?? 0),
  }
})
const summary = {
  probe: 'GGUF reconstructed; not the historical baseline artifact',
  historicalBaseline: 'semantic-action-search-results.json is not modified',
  categories: Object.fromEntries(
    Object.entries(categoryResults).map(([category, cases]) => [category, cases.length]),
  ),
  classification: Object.fromEntries(
    Object.entries(classification).map(([name, cases]) => [
      name,
      cases.map(result => ({
        scenarioId: result.scenarioId,
        expectedAction: result.expectedAction,
        ranks: result.ranks,
        semanticScore: result.semanticScore,
      })),
    ]),
  ),
  representationMetrics,
  representationDiff: {
    gains: representationDiff.filter(result => result.delta > 0),
    losses: representationDiff.filter(result => result.delta < 0),
    unchanged: representationDiff.filter(result => result.delta === 0),
  },
  candidateUnion: Object.fromEntries(
    ['6', '8', '12'].map(limit => [
      limit,
      rate(difficult, result => result.candidateUnionRanks[limit]),
    ]),
  ),
  oracleUnion: {
    evaluations: difficult.length,
    containsExpected: difficult.filter(result => result.oracleUnionContainsExpected).length,
    recall:
      difficult.filter(result => result.oracleUnionContainsExpected).length / difficult.length,
  },
  concentration: Object.fromEntries(
    Object.entries(reports).map(([representation, report]) => [
      representation,
      concentration(report.results.filter(result => result.difficult)),
    ]),
  ),
  e5Audit: {
    queryPrefix: 'query: applied',
    passagePrefix: 'passage: applied',
    pooling: 'GGUF metadata/runtime embedding mode; mean pooling declared by model conversion',
    normalization: 'L2 normalized before storage and again before dot product',
    similarity: 'dot product of unit vectors, equivalent to cosine',
    dimensions: 384,
    context:
      'GGUF exposes 511 positions; spike creates context max 511 but node-llama-cpp reports 512 requested',
    tokenizer: 'XLM-Roberta SentencePiece forced during conversion',
    quantization: 'Q8_0 reconstructed artifact, SHA differs from historical artifact',
  },
}

function percent(value) {
  return `${(value * 100).toFixed(1)} %`
}

const table = rows => rows.map(row => `| ${row.join(' | ')} |`).join('\n')
const markdown = `# Suite du diagnostic Semantic Action Search

## Statut des mesures

- Baseline historique : inchangée.
- Sonde : GGUF reconstruit, donc non substituable à la baseline.
- Cas difficiles : ${difficult.length} actions.

## Catégories strictes, représentation D

${table([['Classe', 'Cas'], ...Object.entries(classification).map(([name, cases]) => [name, cases.length])])}

Une action sémantiquement trouvée et conservée est comptée séparément dans semanticSuccess afin que les quatre ensembles couvrent les ${difficult.length} cas.

## FUSION_FAILURE

${table([['Scénario', 'Action', 'Semantic', 'Algorithmic', 'Hybrid'], ...classification.fusionFailure.map(result => [result.scenarioId, result.expectedAction, result.ranks.semantic, result.ranks.algorithmic, result.ranks.hybrid])])}

## A/B/C/D par catégorie — sémantique seule

${table([
  ['Représentation', 'Catégorie', 'R@1', 'R@3', 'R@5', 'R@12', 'MRR'],
  ...Object.entries(representationMetrics).flatMap(([representation, categories]) =>
    Object.entries(categories)
      .filter(([category]) => category !== 'OTHER_DIFFICULT')
      .map(([category, values]) => [
        representation,
        category,
        percent(values.recallAt1),
        percent(values.recallAt3),
        percent(values.recallAt5),
        percent(values.recallAt12),
        values.mrr.toFixed(4),
      ]),
  ),
])}

## C vs D — sémantique seule

- gains C : ${summary.representationDiff.gains.length}
- pertes C : ${summary.representationDiff.losses.length}
- inchangés : ${summary.representationDiff.unchanged.length}

Le détail action par action est dans le JSON.

## Candidate union et oracle

${table([['Union', 'R@1', 'R@3', 'R@5', 'R@12'], ...Object.entries(summary.candidateUnion).map(([limit, values]) => [`${limit}+${limit}`, percent(values.recallAt1), percent(values.recallAt3), percent(values.recallAt5), percent(values.recallAt12)])])}

Oracle union top-12 + top-12 : ${summary.oracleUnion.containsExpected}/${summary.oracleUnion.evaluations} (${percent(summary.oracleUnion.recall)}).

## Concentration des cosines

${table([['Représentation', 'Top-1 moyen', 'Attendu moyen', 'Écart top-1/attendu', 'Écart top-1/top-12', 'Écart-type top-50'], ...Object.entries(summary.concentration).map(([representation, values]) => [representation, values.top1Mean.toFixed(4), values.expectedMean.toFixed(4), values.top1ExpectedGapMean.toFixed(4), values.top1Top12GapMean.toFixed(4), values.top50StandardDeviation.toFixed(4)])])}

## Audit technique

${Object.entries(summary.e5Audit)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}
`

writeFileSync(
  join(output, 'semantic-deep-diagnostic-summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
)
writeFileSync(join(output, 'semantic-deep-diagnostic-summary.md'), `${markdown}\n`)
