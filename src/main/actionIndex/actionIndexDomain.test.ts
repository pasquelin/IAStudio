import { expect, it, onTestFinished } from 'vitest'
import { assistantAction } from '@shared/domain/assistant'
import { openMemoryDatabase } from '@main/project/sqliteMemory'
import { actionCorpus } from './actionCorpus'
import { createActionIndex } from './actionIndex'

function search(query: string, document: 'scene' | 'sequence'): readonly string[] {
  const database = openMemoryDatabase()
  onTestFinished(() => database.close())
  const index = createActionIndex(database)
  index.rebuild(actionCorpus())
  return index
    .search({ query, limit: 12, scope: { document, documentAuthority: 'explicit' } })
    .map(hit => hit.action.name)
}

it('offers asset discovery beside an operation that consumes a project asset', () => {
  expect(
    search('Ajoute ma première vidéo sur la piste V1 au début de la timeline.', 'sequence'),
  ).toEqual(expect.arrayContaining(['clip.add', 'assets.searchProjectCatalogue']))
  expect(assistantAction('clip.add')?.inputs).toBeUndefined()
})

it('derives localized component semantics from the component registry', () => {
  expect(search('Monte la santé maximum de cet objet à 250.', 'scene')).toContain(
    'component.setProperties',
  )
})

it('derives localized command semantics from the command registry', () => {
  expect(
    search("Suis la sélection pour qu'elle reste visible pendant son mouvement.", 'scene'),
  ).toContain('command.runStudioCommand')
})
