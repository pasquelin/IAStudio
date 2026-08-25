import { describe, expect, it } from 'vitest'
import { HISTORY_BLOCK_MAX } from '@shared/domain/assistant'
import { assistantHistory, type AssistantStep, type AssistantTurn } from './conversation'

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

/**
 * What an action ANSWERED, which is what makes a chain possible: without it the model has run a
 * search and cannot open what it found. Bounded, because a project listing is thousands of
 * entries and the whole briefing has some eight thousand characters to live in.
 */
describe('what a step answered, as the model reads it', () => {
  it('carries the answer beside the action, so the next round can use it', () => {
    const [block] = assistantHistory([
      turn({ steps: [{ action: 'files.search', refusal: null, data: ['Images/Voilier.png'] }] }),
    ])

    expect(block).toContain('files.search')
    expect(block).toContain('Images/Voilier.png')
  })

  /**
   * 🛑 Dropped by WHOLE entries and counted: half a path is a path the model calls with, and a
   * call on half a path opens nothing. A model told nothing of what was cut plans against a
   * project half of which it cannot see.
   */
  it('cuts a long list by entries and says how many it did not show', () => {
    const many = [...Array(300).keys()].map(at => `Images/asset_${at}.png`)
    const [block] = assistantHistory([
      turn({ steps: [{ action: 'files.search', refusal: null, data: many }] }),
    ])

    expect(block).toContain('300 results')
    expect(block).toMatch(/and \d+ more, not shown/)
    // Never a broken entry at the cut: every path quoted is one the model may call with.
    expect(block).not.toMatch(/Images\/asset_\d+\.pn"/)
  })

  // A chain cut at its ceiling reads exactly like one that finished — to the model too, which
  // would take a half-done job for a done one and answer the next sentence against it.
  it('tells the model a chain was cut rather than finished', () => {
    const [halted] = assistantHistory([turn({ ending: 'halted' })])
    const [stopped] = assistantHistory([turn({ ending: 'stopped' })])

    expect(halted).toContain('too many rounds')
    expect(stopped).toContain('stopped you')
  })
})

/**
 * 🛑 A chain writes into ONE block, which grows at every round — and a block past the boundary's
 * bound is refused WHOLE: `parseThought` throws, the window reads nothing back, and a chain that
 * was working dies as "I did not manage to answer that one". Measured at 16 260 characters for
 * twelve rounds of two acting calls, against a bound of ten thousand.
 */
describe('a block long enough to be refused', () => {
  const long = (steps: number): AssistantTurn =>
    turn({
      steps: [...Array(steps).keys()].map((at): AssistantStep => ({
        action: 'files.search',
        refusal: null,
        data: [...Array(20).keys()].map(one => `Images/asset_${at}_${one}.png`),
      })),
    })

  it('cuts it to what the boundary takes, keeping the sentence and the latest steps', () => {
    const [block = ''] = assistantHistory([long(40)])

    expect(block.length).toBeLessThanOrEqual(HISTORY_BLOCK_MAX)
    expect(block).toContain('ouvre un fichier 3D')
    // The LAST steps are the ones a round is about to build on.
    expect(block).toContain('asset_39_')
    expect(block).toContain('earlier steps not shown')
  })

  // A model that cannot tell a block was cut plans against steps it believes never ran.
  it('leaves a short block untouched', () => {
    const [block = ''] = assistantHistory([long(1)])

    expect(block).not.toContain('earlier steps not shown')
  })
})
