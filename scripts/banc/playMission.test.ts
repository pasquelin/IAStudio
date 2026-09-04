import { describe, expect, it } from 'vitest'
import { actionCorpus } from '@main/actionIndex/actionCorpus'
import { playMission } from './playMission'

describe('parcours mission du banc', () => {
  it('garde le même studio et le même oracle tout en bornant les actions envoyées', async () => {
    const action = actionCorpus().actions.find(candidate => candidate.name === 'documents.list')
    if (!action) throw new Error('documents.list est absente du registre')
    let round = 0
    const played = await playMission(
      {
        name: 'liste les documents',
        said: ['Liste les documents.'],
        passed: run => run.called.some(call => call.action === 'documents.list'),
      },
      async request => {
        expect(request.candidates).toEqual(['documents.list'])
        round += 1
        return round === 1
          ? { say: 'Je regarde.', calls: [{ action: 'documents.list', input: {} }], cost: 0 }
          : { say: 'Terminé.', calls: [], cost: 0 }
      },
      {
        search: async () => [{ action, score: 1, lexicalScore: 1 }],
      },
    )

    try {
      expect(played.called.map(call => call.action)).toEqual(['documents.list'])
      expect(played.metrics.llmCalls).toBe(2)
      expect(played.metrics.actionsSentToLlm).toBe(2)
      expect(played.metrics.contextChars).toBeGreaterThan(0)
    } finally {
      played.studio.close()
    }
  })
})
