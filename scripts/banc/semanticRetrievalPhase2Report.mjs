import { mkdir, readFile, writeFile } from 'node:fs/promises'

const input = '.agents/loop-todo/semantic-deep-diagnostic.json'
const output = '.agents/loop-todo'
const raw = JSON.parse(await readFile(input, 'utf8'))
const reports = Object.fromEntries(raw.reports.map(report => [report.representation, report]))
const baseline = reports.business
const difficult = baseline.results.filter(result => result.difficult)
const byKey = report =>
  new Map(
    report.results
      .filter(result => result.difficult)
      .map(result => [`${result.scenarioId}/${result.expectedAction}`, result]),
  )
const variants = Object.fromEntries(
  Object.entries(reports).map(([key, report]) => [key, byKey(report)]),
)

const rankOf = (ranking, expected) => {
  const index = ranking.findIndex(candidate => candidate.name === expected)
  return index < 0 ? ranking.length + 1 : index + 1
}
const metrics = ranks => {
  const count = ranks.length
  const at = limit => ranks.filter(rank => rank <= limit).length / count
  return {
    evaluations: count,
    r1: at(1),
    r3: at(3),
    r5: at(5),
    r12: at(12),
    mrr: ranks.reduce((sum, rank) => sum + 1 / rank, 0) / count,
  }
}
const percentage = value => `${(value * 100).toFixed(1)} %`
const table = rows => rows.map(row => `| ${row.join(' | ')} |`).join('\n')
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length

const queryIntent = query => {
  const text = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (/(supprim|retir|jette|efface|delete|remove|drop|unstage)/.test(text)) return 'delete'
  if (
    /(combien|quelle|quelles|donne|montre|historique|informations|peut-il|what|which|show|list)/.test(
      text,
    )
  )
    return 'read'
  if (/(cherche|trouve|find|search)/.test(text)) return 'search'
  if (/(cree|creer|ajoute|fais ecrire|generate|create|add|write)/.test(text)) return 'create'
  if (/(ouvre|telecharge|recupere|arrete|prepare|lance|open|pull|cancel|stage|submit)/.test(text))
    return 'execute'
  return 'mutate'
}
const actionIntent = name => {
  const verb = name.split('.')[1] ?? ''
  if (/^(state|list|get|read|report|describe|facts|counts|capabilities|can)/.test(verb))
    return 'read'
  if (/^(search|find|browse)/.test(verb)) return 'search'
  if (/^(remove|delete|trash|drop|unstage|clear|detach)/.test(verb)) return 'delete'
  if (/^(add|create|prepare|duplicate|copy|write|draw)/.test(verb)) return 'create'
  if (/^(run|submit|open|close|cancel|pull|stage|activate|index)/.test(verb)) return 'execute'
  return 'mutate'
}
const sortScores = scores =>
  [...scores].sort((a, b) => b.cosine - a.cosine || a.name.localeCompare(b.name))
const familyRanking = result => {
  const scores = new Map()
  for (const candidate of result.semanticAll)
    scores.set(
      candidate.family,
      Math.max(scores.get(candidate.family) ?? -Infinity, candidate.cosine),
    )
  return [...scores]
    .map(([family, cosine]) => ({ family, cosine }))
    .sort((a, b) => b.cosine - a.cosine)
}
const hierarchy = count =>
  difficult.map(result => {
    const domains = new Set(
      familyRanking(result)
        .slice(0, count)
        .map(domain => domain.family),
    )
    return rankOf(
      result.semanticAll.filter(candidate => domains.has(candidate.family)),
      result.expectedAction,
    )
  })
const domainRecall = count =>
  mean(
    difficult.map(result => {
      const domains = new Set(
        familyRanking(result)
          .slice(0, count)
          .map(domain => domain.family),
      )
      return domains.has(
        result.semanticAll.find(candidate => candidate.name === result.expectedAction)?.family,
      )
        ? 1
        : 0
    }),
  )

const multiVector = mode =>
  difficult.map(result => {
    const key = `${result.scenarioId}/${result.expectedAction}`
    const all = ['name', 'brief', 'compact', 'business'].map(
      representation => variants[representation].get(key).semanticAll,
    )
    const actions = all[0].map(candidate => candidate.name)
    const scores = actions.map(name => {
      const values = all
        .map(ranking => ranking.find(candidate => candidate.name === name).cosine)
        .sort((a, b) => b - a)
      const cosine =
        mode === 'max'
          ? values[0]
          : mode === 'meanTop2'
            ? (values[0] + values[1]) / 2
            : values[0] * 0.7 + values[1] * 0.3
      return { name, cosine }
    })
    return rankOf(sortScores(scores), result.expectedAction)
  })

const intentThenDomain = difficult.map(result => {
  const intent = queryIntent(result.request)
  const intentCandidates = result.semanticAll.filter(
    candidate => actionIntent(candidate.name) === intent,
  )
  const domains = new Set(
    familyRanking({ semanticAll: intentCandidates })
      .slice(0, 3)
      .map(domain => domain.family),
  )
  return rankOf(
    intentCandidates.filter(candidate => domains.has(candidate.family)),
    result.expectedAction,
  )
})
const domainThenIntent = difficult.map(result => {
  const domains = new Set(
    familyRanking(result)
      .slice(0, 3)
      .map(domain => domain.family),
  )
  const candidates = result.semanticAll.filter(candidate => domains.has(candidate.family))
  const intent = queryIntent(result.request)
  const boosted = candidates.map(candidate => ({
    ...candidate,
    cosine: candidate.cosine + (actionIntent(candidate.name) === intent ? 0.015 : 0),
  }))
  return rankOf(sortScores(boosted), result.expectedAction)
})

const expansionTerms = [
  [/mise de cote|stash|shelved/, ['stash', 'git']],
  [/1080|cadre|frame|echelle|scale|remplir/, ['canvas', 'resize', 'transform']],
  [/eclair|light/, ['scene', 'light']],
  [/texture|material|normal map/, ['material', 'mesh']],
  [/voiture|model|modele.*scene/, ['scene', 'model', 'add']],
  [/volume|gain/, ['clip', 'gain', 'audio']],
]
const expandedRanks = difficult.map(result => {
  const normalized = result.request
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const terms = expansionTerms
    .filter(([pattern]) => pattern.test(normalized))
    .flatMap(([, terms]) => terms)
  const scores = result.semanticAll.map(candidate => ({
    ...candidate,
    cosine:
      candidate.cosine +
      terms.reduce(
        (sum, term) => sum + (candidate.name.toLowerCase().includes(term) ? 0.012 : 0),
        0,
      ),
  }))
  return rankOf(sortScores(scores), result.expectedAction)
})

const oracle = difficult.map(result => (result.oracleUnionContainsExpected ? 1 : 0))
const statuses = new Map([
  [
    '15.6/clip.speed',
    {
      status: 'WRONG_EXPECTED_ACTION',
      reason: 'Le scénario accepte clip.transform ; clip.speed ne règle ni échelle ni cadrage.',
    },
  ],
  [
    '49.7/channel.setMuteSoloLock',
    {
      status: 'WRONG_EXPECTED_ACTION',
      reason:
        'Mute/solo/verrouillage ne boucle pas un canal ; le banc ne vérifie que la réponse acceptée.',
    },
  ],
  [
    '33.1/clip.add',
    {
      status: 'AMBIGUOUS_EXPECTED_ACTION',
      reason:
        'Demande composite : génération, ajout, montage, clips et audio ; une seule action ne suffit pas.',
    },
  ],
  [
    '66.1/generator.prepare',
    {
      status: 'AMBIGUOUS_EXPECTED_ACTION',
      reason: 'Étape d’un workflow multi-actions, pas une intention isolée.',
    },
  ],
  [
    '66.1/generator.submit',
    {
      status: 'AMBIGUOUS_EXPECTED_ACTION',
      reason: 'Étape d’un workflow multi-actions, pas une intention isolée.',
    },
  ],
  [
    '66.2/generator.prepare',
    {
      status: 'AMBIGUOUS_EXPECTED_ACTION',
      reason: 'Étape d’un workflow multi-actions, pas une intention isolée.',
    },
  ],
  [
    '66.2/generator.submit',
    {
      status: 'AMBIGUOUS_EXPECTED_ACTION',
      reason: 'Étape d’un workflow multi-actions, pas une intention isolée.',
    },
  ],
  [
    '66.2/file.open',
    {
      status: 'AMBIGUOUS_EXPECTED_ACTION',
      reason: 'Étape d’un workflow multi-actions, pas une intention isolée.',
    },
  ],
  [
    '66.4/generator.prepare',
    {
      status: 'AMBIGUOUS_EXPECTED_ACTION',
      reason: 'Étape d’un workflow multi-actions, pas une intention isolée.',
    },
  ],
  [
    '66.4/generator.submit',
    {
      status: 'AMBIGUOUS_EXPECTED_ACTION',
      reason: 'Étape d’un workflow multi-actions, pas une intention isolée.',
    },
  ],
])
const audit = difficult.map(result => ({
  scenarioId: result.scenarioId,
  expectedAction: result.expectedAction,
  request: result.request,
  ...(statuses.get(`${result.scenarioId}/${result.expectedAction}`) ?? {
    status: 'VALID_EXPECTED_ACTION',
    reason: 'Cohérent avec l’intention unique et l’action attendue du scénario.',
  }),
}))
const valid = audit
  .map((entry, index) => (entry.status === 'VALID_EXPECTED_ACTION' ? index : -1))
  .filter(index => index >= 0)
const strictOracle = valid.map(index => oracle[index])

const strategies = [
  [
    'Sémantique D, global',
    metrics(difficult.map(result => result.ranks.semantic)),
    mean(oracle),
    'sonde mesurée',
  ],
  ['Hiérarchie domaine top-1', metrics(hierarchy(1)), domainRecall(1), 'sonde mesurée'],
  ['Hiérarchie domaine top-2', metrics(hierarchy(2)), domainRecall(2), 'sonde mesurée'],
  ['Hiérarchie domaine top-3', metrics(hierarchy(3)), domainRecall(3), 'sonde mesurée'],
  ['Intent → domaine top-3', metrics(intentThenDomain), null, 'proxy déterministe'],
  ['Domaine top-3 → intent', metrics(domainThenIntent), domainRecall(3), 'proxy déterministe'],
  ['Multi-vecteur max A/B/C/D', metrics(multiVector('max')), null, 'sonde mesurée'],
  ['Multi-vecteur moyenne top-2', metrics(multiVector('meanTop2')), null, 'sonde mesurée'],
  ['Multi-vecteur max pondéré', metrics(multiVector('weightedMax')), null, 'sonde mesurée'],
  ['Expansion déterministe légère', metrics(expandedRanks), null, 'proxy déterministe'],
]

const payload = {
  probe: 'GGUF reconstruit uniquement ; non comparable à la baseline historique.',
  technicalAudit: {
    e5: 'Préfixes query:/passage:, normalisation L2 et dot-product conformes au modèle ; la sonde GGUF déclare 384 dimensions et 511 tokens. Le runtime signale n_ctx_seq=512 > n_ctx_train=511 : divergence à investiguer, non corrigée.',
    gguf: 'GGUF Q8_0 reconstruit, SHA-256 167b404b82b1cd3a2d4ebd0af3a21c5c317cc9497841d1bc7e4cf0f312e58b42 ; distinct de l’artefact historique attendu.',
  },
  modelShortlist: [
    {
      model: 'intfloat/multilingual-e5-base',
      license: 'MIT',
      languages: '94',
      sourceSize: '1.11 GB safetensors',
      runtime: 'XLM-R ; conversion GGUF à valider',
      decision: 'Candidat direct, plus lourd que small.',
    },
    {
      model: 'Alibaba-NLP/gte-multilingual-base',
      license: 'Apache-2.0',
      languages: '75',
      sourceSize: '611 MB safetensors',
      runtime: 'custom code ; compatibilité llama.cpp non démontrée',
      decision: 'Candidat qualitatif à isoler, pas de téléchargement dans cette phase.',
    },
    {
      model: 'Qwen/Qwen3-Embedding-0.6B',
      license: 'Apache-2.0',
      languages: '29',
      sourceSize: '0.6B paramètres',
      runtime: 'architecture Qwen ; GGUF/embedding llama.cpp à valider',
      decision: 'Candidat moderne, coût CPU/RAM probablement supérieur.',
    },
    {
      model: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      license: 'Apache-2.0',
      languages: '50',
      sourceSize: 'non mesuré',
      runtime: 'ONNX disponible ; GGUF à valider',
      decision: 'Contrôle compact, pas présumé meilleur.',
    },
  ],
  corpus: {
    difficultEvaluations: difficult.length,
    strictValidatedEvaluations: valid.length,
    originalOracleCandidateRecallAt12: mean(oracle),
    strictValidatedOracleCandidateRecallAt12: mean(strictOracle),
  },
  strategies: strategies.map(([name, result, domain, evidence]) => ({
    name,
    candidateOracleRecallAt12: result.r12,
    domainRecall: domain,
    ...result,
    evidence,
  })),
  hierarchy: [1, 2, 3].map(count => ({
    domains: count,
    domainRecall: domainRecall(count),
    ...metrics(hierarchy(count)),
  })),
  multiVector: ['max', 'meanTop2', 'weightedMax'].map(mode => ({
    mode,
    ...metrics(multiVector(mode)),
  })),
  oracleAudit: audit,
  limitations: [
    'Les cas difficiles ne portent pas le StudioSnapshot réel : la mesure query + contexte applicatif disponible est impossible sans rejouer le banc avec ses snapshots.',
    'L’expansion et le routage d’intention sont des proxys déterministes sur scores déjà encodés, non de nouvelles requêtes encodées.',
    'Aucun nouveau modèle n’a été téléchargé ou benchmarké dans cette phase ; la shortlist doit précéder cela.',
  ],
}
const rows = strategies.map(([name, result, _domain, evidence]) => [
  name,
  percentage(result.r12),
  percentage(result.r1),
  percentage(result.r3),
  percentage(result.r5),
  percentage(result.r12),
  result.mrr.toFixed(4),
  'n/a',
  'n/a',
  evidence,
])
const markdown = `# Phase 2 — stratégie de rappel sémantique\n\n> Toutes les mesures ci-dessous proviennent du **GGUF reconstruit** : sonde expérimentale, pas baseline historique.\n\n## Résultat de gate\n\nLe meilleur oracle candidat mesuré reste insuffisant pour la gate de 80 %. La cause est la couverture, non le reranking : l’union historique top-12 algorithmique + top-12 sémantique couvre ${percentage(mean(oracle))} des ${difficult.length} attentes ; après retrait des attentes ambiguës/erronées, ${percentage(mean(strictOracle))} sur ${valid.length} attentes validées.\n\n## Comparaison\n\n${table([['Stratégie', 'Oracle candidat R@12', 'R@1', 'R@3', 'R@5', 'R@12', 'MRR', 'Latence', 'Mémoire', 'Nature'], ...rows])}\n\n## Routage hiérarchique\n\n${table(
  [
    ['Domaines', 'Domain recall', 'R@1', 'R@3', 'R@5', 'R@12', 'MRR'],
    ...[1, 2, 3].map(count => {
      const value = metrics(hierarchy(count))
      return [
        count,
        percentage(domainRecall(count)),
        percentage(value.r1),
        percentage(value.r3),
        percentage(value.r5),
        percentage(value.r12),
        value.mrr.toFixed(4),
      ]
    }),
  ],
)}\n\n## Audit oracle des cas difficiles\n\n${table([['Scénario', 'Action attendue', 'Statut', 'Justification'], ...audit.map(entry => [entry.scenarioId, entry.expectedAction, entry.status, entry.reason])])}\n\n## Limites mesurées\n\n${payload.limitations.map(value => `- ${value}`).join('\n')}\n\n## Conclusion expérimentale\n\nLa décomposition domaine/intention et le multi-vecteur peuvent déplacer des rangs, mais aucun proxy ne démontre une couverture candidate proche de 80 %. Il faut d’abord rejouer avec snapshots réels et encoder les formulations expansées, puis benchmarker un modèle multilingue plus discriminant ; aucune de ces conclusions n’autorise une intégration produit.\n`
await mkdir(output, { recursive: true })
await writeFile(`${output}/semantic-retrieval-phase2.json`, `${JSON.stringify(payload, null, 2)}\n`)
await writeFile(`${output}/semantic-retrieval-phase2.md`, markdown)
console.log(`Wrote ${output}/semantic-retrieval-phase2.{json,md}`)
