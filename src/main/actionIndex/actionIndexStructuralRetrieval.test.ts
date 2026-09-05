import { describe, expect, it, onTestFinished } from 'vitest'
import { openMemoryDatabase } from '@main/project/sqliteMemory'
import { actionCorpus } from './actionCorpus'
import { createActionIndex } from './actionIndex'

describe('ActionIndex structural retrieval', () => {
  const index = () => {
    const database = openMemoryDatabase()
    onTestFinished(() => database.close())
    const actionIndex = createActionIndex(database)
    actionIndex.rebuild(actionCorpus())
    return actionIndex
  }

  it('keeps a selected layer transformation in reach for a relative size request', () => {
    const hits = index().search({
      query: 'Augmente sa taille de 20 %.\nPlan mission',
      limit: 12,
      scope: { target: 'layer', document: 'image', documentAuthority: 'active' },
    })

    expect(hits.map(hit => hit.action.name)).toContain('layer.transform')
  })

  it('distinguishes a project context card from memories and saved styles', () => {
    const ranking = index().inspect({
      query: 'Oublie ce que tu avais retenu sur le style de ce projet.\nPlan mission',
      limit: 12,
      scope: { availableTargets: ['projectContext'] },
    })
    const contextDelete = ranking.find(hit => hit.action.name === 'context.deleteProjectCard')

    expect(contextDelete?.rank).toBeLessThanOrEqual(12)
    expect(contextDelete).toMatchObject({ included: true, compatibilityScore: 8 })
  })
})
