import { mkdir, readFile, writeFile } from 'node:fs/promises'

const output = '.agents/loop-todo'
const diagnostic = JSON.parse(await readFile(`${output}/semantic-deep-diagnostic.json`, 'utf8'))
const phase2 = JSON.parse(await readFile(`${output}/semantic-retrieval-phase2.json`, 'utf8'))
const status = new Map(
  phase2.oracleAudit.map(entry => [`${entry.scenarioId}/${entry.expectedAction}`, entry.status]),
)
const report = diagnostic.reports.find(entry => entry.representation === 'business')
const cases = report.results.filter(
  entry =>
    entry.difficult &&
    status.get(`${entry.scenarioId}/${entry.expectedAction}`) === 'VALID_EXPECTED_ACTION',
)
const ranks = cases.map(entry => entry.ranks.semantic)
const at = limit => ranks.filter(rank => rank <= limit).length / ranks.length
const baseline = {
  evaluations: cases.length,
  r1: at(1),
  r3: at(3),
  r5: at(5),
  r12: at(12),
  mrr: ranks.reduce((total, rank) => total + 1 / rank, 0) / ranks.length,
}
const queryMetrics = ['q0', 'q1', 'q2', 'q3', 'q4'].map(query => {
  const queryRanks = cases.map(entry => entry.queryVariants?.[query]?.rank ?? entry.ranks.semantic)
  const rate = limit => queryRanks.filter(rank => rank <= limit).length / queryRanks.length
  return {
    query,
    r1: rate(1),
    r3: rate(3),
    r5: rate(5),
    r12: rate(12),
    mrr: queryRanks.reduce((total, rank) => total + 1 / rank, 0) / queryRanks.length,
  }
})
const snapshotOf = snapshot => ({
  activeDocument: snapshot?.activeDocumentState?.kind ?? null,
  workspace: snapshot?.activeDocumentState?.workspace ?? null,
  selection: snapshot?.selection ?? null,
  documents:
    snapshot?.documents?.map(document => ({
      kind: document.kind,
      workspace: document.workspace,
      title: document.title,
    })) ?? [],
  project: snapshot?.project?.path ?? null,
})
const routed = entry => ({
  document: entry.runtimeSnapshot?.activeDocumentState?.kind ?? null,
  workspace: entry.runtimeSnapshot?.activeDocumentState?.workspace ?? null,
  selectionKind: entry.runtimeSnapshot?.selection?.kind ?? null,
})
const failures = cases
  .filter(entry => entry.ranks.semantic > 12)
  .map(entry => ({
    scenarioId: entry.scenarioId,
    query: entry.request,
    expandedQuery: entry.semanticQuery,
    snapshot: snapshotOf(entry.runtimeSnapshot),
    expectedAction: entry.expectedAction,
    expectedCosine: entry.semanticScore,
    expectedRank: entry.ranks.semantic,
    routedSignals: routed(entry),
    top12: entry.semanticTop,
    classification: 'SEMANTIC_FAILURE',
    evidence:
      'La requête originale a été encodée réellement ; l’action attendue n’est pas dans les 12 meilleurs cosines.',
  }))
const payload = {
  baseline:
    'E5_SMALL_PHASE3_BASELINE — GGUF reconstruit SHA-256 167b404b82b1cd3a2d4ebd0af3a21c5c317cc9497841d1bc7e4cf0f312e58b42 ; distinct de la baseline historique.',
  technicalAudit: {
    tokenizer:
      'Tokenizer contenu dans le GGUF reconstruit ; le runtime signale un newline token absent.',
    context:
      'GGUF 511 positions, alors que node-llama-cpp signale n_ctx_seq=512 > n_ctx_train=511.',
    embedding: '384 dimensions ; préfixes query:/passage:, L2 et dot product.',
  },
  validUnitaryCases: cases.map(entry => ({
    scenarioId: entry.scenarioId,
    userQuery: entry.request,
    runtimeSnapshot: snapshotOf(entry.runtimeSnapshot),
    derivedRoutingSignals: routed(entry),
    expectedAction: entry.expectedAction,
  })),
  measurements: queryMetrics.map(value => ({
    model: 'E5_SMALL_PHASE3_BASELINE',
    queryRepresentation: value.query,
    routing: 'none',
    candidatePoolSize: 297,
    oracleCandidateRecallAt12: value.r12,
    evaluations: cases.length,
    ...value,
  })),
  gte: {
    status: 'STOPPED_TECHNICAL_RUNTIME_INCOMPATIBILITY',
    reason:
      'Le modèle officiel exige trust_remote_code pour AutoModel/SentenceTransformer. Le spike repose sur node-llama-cpp GGUF ; aucun artefact GGUF officiel et aucune compatibilité de conversion/pooling n’est démontrée. Aucun téléchargement ni benchmark ne serait comparable sans introduire un runtime distinct.',
    official: {
      license: 'Apache-2.0',
      parameters: '305M',
      dimensions: 768,
      maxTokens: 8192,
      sourceDisk: '611 MB safetensors',
    },
  },
  remainingFailures: failures,
  unavailableRealMeasurements: [
    'Routage hiérarchique réel : non encore exécuté ; les résultats Phase 2 sont exclus de cette baseline.',
  ],
  workflowRetrieval:
    'Conservé séparément : 8 attentes ambiguës ne participent pas aux 40 métriques unitaires.',
}
const percent = value => `${(value * 100).toFixed(1)} %`
const markdown = `# Phase 3 — baseline réelle en cours\n\n## E5_SMALL_PHASE3_BASELINE\n\n${payload.baseline}\n\n- Cas unitaires validés : ${cases.length}.\n- Q0 réellement encodée avec les snapshots réellement rejoués et archivés par cas.\n- R@1 ${percent(baseline.r1)}, R@3 ${percent(baseline.r3)}, R@5 ${percent(baseline.r5)}, R@12/oracle ${percent(baseline.r12)}, MRR ${baseline.mrr.toFixed(4)}.\n\n## GTE\n\nArrêt avant téléchargement : ${payload.gte.reason}\n\n## Mesures volontairement non substituées\n\n${payload.unavailableRealMeasurements.map(value => `- ${value}`).join('\n')}\n\n## Échecs Q0\n\n${failures
  .map(
    entry =>
      `### ${entry.scenarioId} — ${entry.expectedAction}\n\n- Query : ${entry.query}\n- Rang/cosine : ${entry.expectedRank} / ${entry.expectedCosine.toFixed(4)}\n- Snapshot : ${JSON.stringify(entry.snapshot)}\n- Top 3 : ${entry.top12
        .slice(0, 3)
        .map(candidate => `${candidate.name} (${candidate.cosine.toFixed(4)})`)
        .join(', ')}\n- Classification : ${entry.classification}. ${entry.evidence}`,
  )
  .join('\n\n')}\n`
await mkdir(output, { recursive: true })
await writeFile(`${output}/semantic-retrieval-phase3.json`, `${JSON.stringify(payload, null, 2)}\n`)
await writeFile(`${output}/semantic-retrieval-phase3.md`, markdown)
console.log(`Wrote ${output}/semantic-retrieval-phase3.{json,md}`)
