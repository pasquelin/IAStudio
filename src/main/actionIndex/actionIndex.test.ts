import { describe, expect, it, onTestFinished } from 'vitest'
import { ACTION_REGISTRY } from '@shared/domain/assistant'
import { openMemoryDatabase } from '@main/project/sqliteMemory'
import { actionCorpus, actionFingerprint } from './actionCorpus'
import { createActionIndex } from './actionIndex'

describe('ActionIndex', () => {
  it('derives every registered action without maintaining another action list', () => {
    const corpus = actionCorpus()
    expect(ACTION_REGISTRY).toHaveLength(297)
    expect(corpus.actions).toHaveLength(ACTION_REGISTRY.length)
    expect(corpus.actions.map(action => action.name)).toEqual(
      ACTION_REGISTRY.map(action => action.name),
    )
  })

  it('keeps its fingerprint stable until a descriptor changes', () => {
    const first = actionCorpus()
    const second = actionCorpus()
    expect(second.fingerprint).toBe(first.fingerprint)
    expect(actionFingerprint(first.actions.slice(1))).not.toBe(first.fingerprint)
  })

  it('rebuilds only when the registry fingerprint changes', () => {
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const index = createActionIndex(database)
    const corpus = actionCorpus()
    expect(index.rebuild(corpus)).toMatchObject({ rebuilt: true, count: 297 })
    expect(index.rebuild(corpus)).toMatchObject({ rebuilt: false, count: 297 })

    const changed = { ...corpus, fingerprint: 'changed' }
    expect(index.rebuild(changed).rebuilt).toBe(true)
    expect(index.fingerprint()).toBe('changed')
    expect(index.count()).toBe(297)
  })

  it('uses FTS5 to rank close action names and descriptions', () => {
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const index = createActionIndex(database)
    index.rebuild(actionCorpus())
    const hits = index.search({ query: 'create project' })
    expect(hits[0]?.action.name).toBe('project.create')
    expect(hits.length).toBeLessThanOrEqual(5)
    expect(index.search({ query: 'layer' }).some(hit => hit.action.name.includes('layer'))).toBe(
      true,
    )
  })

  it('retrieves actions from the translated user request without translating the manuals', () => {
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const index = createActionIndex(database)
    index.rebuild(actionCorpus())

    expect(
      index.search({ query: 'ajoute un cube au centre de la scène' }).map(hit => hit.action.name),
    ).toContain('node.add')
    expect(index.search({ query: 'crée un nouveau projet' }).map(hit => hit.action.name)).toContain(
      'project.create',
    )
    const requests = [
      ['renomme objet scène 3D cube Cube Test', 'node.rename'],
      ['change la couleur du premier matériau en rouge', 'node.setMeshMaterial'],
      ['génère une image photoréaliste', 'generator.prepare'],
      ['génère un modèle 3D', 'generator.prepare'],
      ['mets le projet sous gestion de versions', 'git.init'],
    ]
    for (const [query, expected] of requests) {
      const names = index.search({ query: query ?? '', limit: 12 }).map(hit => hit.action.name)
      expect(names, `${query}: ${JSON.stringify(names)}`).toContain(expected)
    }
    const renameHits = index.search({
      query: 'Renomme le cube Cube Test.\nPlan mission',
      limit: 12,
    })
    expect(
      renameHits.map(hit => hit.action.name),
      JSON.stringify(renameHits.map(hit => [hit.action.name, hit.score, hit.lexicalScore])),
    ).toContain('node.rename')
    expect(
      index
        .search({
          query: 'Change la couleur de base du premier matériau en rouge.\nPlan mission',
          limit: 12,
        })
        .map(hit => hit.action.name),
    ).toContain('node.setMeshMaterial')
  })

  it('lets BM25 rank descriptive matches before registry order', () => {
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const source = actionCorpus().actions.slice(0, 2)
    const actions = source.map((action, at) => ({
      ...action,
      title: '',
      description: at === 0 ? 'quasar' : 'quasar quasar quasar quasar',
      searchable: at === 0 ? 'quasar' : 'quasar quasar quasar quasar',
    }))
    const index = createActionIndex(database)
    index.rebuild({ actions, fingerprint: actionFingerprint(actions) })
    expect(index.search({ query: 'quasar' })[0]?.action.name).toBe(actions[1]?.name)
  })

  it('retrieves transitive workflow prerequisites and favours available continuations', () => {
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const index = createActionIndex(database)
    index.rebuild(actionCorpus())

    const discovery = index.search({ query: 'génère une image photoréaliste', limit: 12 })
    expect(discovery.map(hit => hit.action.name)).toEqual(
      expect.arrayContaining(['models.search', 'generator.prepare']),
    )
    const continuation = index.search({
      query: 'génère une image photoréaliste',
      limit: 12,
      available: ['generationModelCandidates'],
    })
    expect(
      continuation.find(hit => hit.action.name === 'generator.prepare')?.workflowScore,
    ).toBeGreaterThan(0)
    expect(
      discovery.find(hit => hit.action.name === 'models.search')?.action.description,
    ).toContain('not the content to generate')
  })

  it('uses structural scope without mixing it into the lexical query', () => {
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const index = createActionIndex(database)
    index.rebuild(actionCorpus())

    const hits = index.search({
      query: 'renomme la sélection',
      limit: 12,
      scope: { target: 'node' },
    })

    expect(hits.map(hit => hit.action.name)).toContain('node.rename')
    expect(hits.find(hit => hit.action.name === 'node.rename')?.scopeScore).toBe(4)
  })

  it('ranks an action targeting the selection above a similarly worded document action', () => {
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const index = createActionIndex(database)
    index.rebuild(actionCorpus())

    const hits = index.search({
      query: 'Change la couleur de base de son premier matériau en rouge.\nPlan mission',
      limit: 12,
      scope: { target: 'node', document: 'scene' },
    })

    expect(hits.findIndex(hit => hit.action.name === 'node.setMeshMaterial')).toBeLessThan(
      hits.findIndex(hit => hit.action.name === 'material.setSurfaceSettings'),
    )
    expect(hits.find(hit => hit.action.name === 'material.setSurfaceSettings')?.scopeScore).toBe(-2)
  })

  it('replaces fields, vectors and FTS words when the corpus changes', () => {
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const original = actionCorpus()
    const first = original.actions[0]
    if (!first) throw new Error('the action corpus is empty')
    const changedAction = { ...first, searchable: `${first.searchable} ultramarineindexword` }
    const changedActions = [changedAction, ...original.actions.slice(1)]
    const index = createActionIndex(database)
    index.rebuild({ actions: changedActions, fingerprint: actionFingerprint(changedActions) })
    index.writeEmbeddings([{ name: first.name, model: 'fixture', values: new Float32Array([1]) }])
    expect(index.search({ query: 'ultramarineindexword' })[0]?.action.name).toBe(first.name)
    expect(database.prepare('SELECT count(*) AS count FROM action_fields').get()).toBeDefined()

    index.rebuild(original)
    expect(index.search({ query: 'ultramarineindexword' })).toEqual([])
    expect(index.embeddingModel()).toBeNull()
  })

  it('bounds an ambiguous query and keeps close names ordered by intent', () => {
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const index = createActionIndex(database)
    index.rebuild(actionCorpus())
    const ambiguous = index.search({ query: 'open', limit: 3 })
    expect(ambiguous).toHaveLength(3)
    expect(index.search({ query: 'project open' })[0]?.action.name).toBe('project.open')
  })

  it('bounds requested results and rejects punctuation-only questions', () => {
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const index = createActionIndex(database)
    index.rebuild(actionCorpus())
    expect(index.search({ query: 'scene', limit: 100 })).toHaveLength(12)
    expect(index.search({ query: '---', limit: 4 })).toEqual([])
  })

  it('adds semantic ranking when compatible embeddings exist', () => {
    const corpus = actionCorpus()
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const index = createActionIndex(database)
    index.rebuild(corpus)
    const target = corpus.actions.find(action => action.name === 'project.create')
    if (!target) throw new Error('project.create is absent')
    index.writeEmbeddings([
      { name: target.name, model: 'fixture', values: new Float32Array([1, 0]) },
    ])
    const hits = index.search({
      query: 'make something new',
      embedding: { model: 'fixture', values: new Float32Array([1, 0]) },
    })
    expect(hits[0]?.action.name).toBe('project.create')
    expect(hits[0]?.semanticScore).toBe(1)
  })

  it('falls back to lexical results without embeddings or with another model', () => {
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const index = createActionIndex(database)
    index.rebuild(actionCorpus())
    expect(index.search({ query: 'project create' })[0]?.action.name).toBe('project.create')
    const incompatible = index.search({
      query: 'project create',
      embedding: { model: 'other', values: new Float32Array([1, 0]) },
    })
    expect(incompatible[0]?.action.name).toBe('project.create')
    expect(incompatible[0]?.semanticScore).toBeUndefined()
  })
})
