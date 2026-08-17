import { describe, expect, it } from 'vitest'
import { assistantHistory, type AssistantTurn } from './conversation'

const turn = (fields: Partial<AssistantTurn> = {}): AssistantTurn => ({
  id: 1,
  said: 'ouvre un fichier 3D',
  answered: '',
  steps: [],
  lost: false,
  ...fields,
})

describe('the conversation the model reads', () => {
  /** The API takes ten blocks. A block per line would spend the budget on two exchanges. */
  it('folds a whole turn into one block, whatever the turn holds', () => {
    const blocks = assistantHistory([
      turn({
        id: 1,
        answered: 'J’ouvre un fichier 3D.',
        steps: [
          { action: 'workspace.open', refusal: null },
          { action: 'models.search', refusal: null },
        ],
      }),
      turn({ id: 2, said: 'et maintenant génère' }),
    ])

    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toContain('ouvre un fichier 3D')
    expect(blocks[0]).toContain('workspace.open')
    expect(blocks[0]).toContain('models.search')
    expect(blocks[1]).toContain('et maintenant génère')
  })

  /**
   * The suite runs in French — `testSetup` says so — which is what makes this worth asserting:
   * a studio running in French must not have the model decide differently from one running in
   * English.
   */
  it('states a refusal in English, whatever the studio is running in', () => {
    const [block] = assistantHistory([
      turn({ steps: [{ action: 'generator.submit', refusal: 'declined' }] }),
    ])

    expect(block).toContain('You turned that action down.')
  })

  // A turn showing as nothing at all has the model repeat the sentence it already failed on.
  it('says so when a turn came to nothing', () => {
    const [block] = assistantHistory([turn({ lost: true })])

    expect(block).toContain('did not manage to answer')
  })
})
