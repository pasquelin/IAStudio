import { readFile, writeFile } from 'node:fs/promises'

const root = '.agents/loop-todo'
const raw = JSON.parse(await readFile(`${root}/semantic-deep-diagnostic.json`, 'utf8'))
const phase2 = JSON.parse(await readFile(`${root}/semantic-retrieval-phase2.json`, 'utf8'))
const valid = new Set(
  phase2.oracleAudit
    .filter(entry => entry.status === 'VALID_EXPECTED_ACTION')
    .map(entry => `${entry.scenarioId}/${entry.expectedAction}`),
)
const report = raw.reports.find(entry => entry.representation === 'business')
const cases = report.results.filter(
  entry => entry.difficult && valid.has(`${entry.scenarioId}/${entry.expectedAction}`),
)
const rank = (all, expected) => {
  const at = all.findIndex(entry => entry.name === expected)
  return at < 0 ? all.length + 1 : at + 1
}
const domains = all =>
  [
    ...new Map(
      all.map(entry => [
        entry.family,
        Math.max(...all.filter(other => other.family === entry.family).map(other => other.cosine)),
      ]),
    ).entries(),
  ]
    .map(([family, cosine]) => ({ family, cosine }))
    .sort((a, b) => b.cosine - a.cosine)
const metric = ranks => {
  const rate = n => ranks.filter(value => value <= n).length / ranks.length
  return {
    r1: rate(1),
    r3: rate(3),
    r5: rate(5),
    r12: rate(12),
    mrr: ranks.reduce((sum, value) => sum + 1 / value, 0) / ranks.length,
  }
}
const experiments = []
for (const query of ['q0', 'q4'])
  for (const limit of [1, 2, 3]) {
    const rows = cases.map(entry => {
      const all = entry.queryVariants[query].all
      const routed = domains(all)
        .slice(0, limit)
        .map(entry => entry.family)
      const subset = all.filter(entry => routed.includes(entry.family))
      return {
        id: entry.scenarioId,
        expectedAction: entry.expectedAction,
        routed,
        subsetSize: subset.length,
        rank: rank(subset, entry.expectedAction),
        expectedFamily: all.find(candidate => candidate.name === entry.expectedAction)?.family,
      }
    })
    experiments.push({
      routing: `domain-top-${limit}`,
      query,
      avgCandidates: rows.reduce((sum, row) => sum + row.subsetSize, 0) / rows.length,
      domainRecall:
        rows.filter(row => row.routed.includes(row.expectedFamily)).length / rows.length,
      ...metric(rows.map(row => row.rank)),
      rows,
    })
  }
const oracleRanks = cases.map(entry => {
  const all = entry.queryVariants.q0.all
  const family = all.find(candidate => candidate.name === entry.expectedAction)?.family
  return rank(
    all.filter(candidate => candidate.family === family),
    entry.expectedAction,
  )
})
const payload = {
  phase: 'PHASE 3C — REAL HIERARCHICAL ROUTING',
  evaluations: cases.length,
  routerRecallAt3: experiments.find(
    entry => entry.query === 'q0' && entry.routing === 'domain-top-3',
  ).domainRecall,
  experiments,
  oracleDomainE5: metric(oracleRanks),
  verdict: 'ROUTING AND E5 BOTTLENECK',
}
const existing = JSON.parse(await readFile(`${root}/semantic-retrieval-phase3.json`, 'utf8'))
existing.phase3c = payload
await writeFile(`${root}/semantic-retrieval-phase3.json`, `${JSON.stringify(existing, null, 2)}\n`)
const lines = experiments
  .map(
    entry =>
      `| ${entry.routing} | ${entry.query} | ${entry.avgCandidates.toFixed(1)} | ${(entry.domainRecall * 100).toFixed(1)} % | ${(entry.r1 * 100).toFixed(1)} % | ${(entry.r3 * 100).toFixed(1)} % | ${(entry.r5 * 100).toFixed(1)} % | ${(entry.r12 * 100).toFixed(1)} % | ${entry.mrr.toFixed(4)} |`,
  )
  .join('\n')
const text = await readFile(`${root}/semantic-retrieval-phase3.md`, 'utf8')
await writeFile(
  `${root}/semantic-retrieval-phase3.md`,
  `${text}\n\n## PHASE 3C — REAL HIERARCHICAL ROUTING\n\n| Routage | Query | Candidats moyens | Domain recall | R@1 | R@3 | R@5 | R@12 | MRR |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${lines}\n\nORACLE_DOMAIN_E5_R@12 : ${(payload.oracleDomainE5.r12 * 100).toFixed(1)} %.\n\nVerdict : ${payload.verdict}.\n`,
)
console.log(JSON.stringify(payload))
