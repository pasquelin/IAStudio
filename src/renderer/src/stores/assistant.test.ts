import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ActionName,
  ActionOutcome,
  AssistantAnswer,
  AssistantThought,
} from '@shared/domain/assistant'
import { installFakeBridge } from '@/services/fake-bridge'
import { useAssistant } from './assistant'

/**
 * The executor stands in: what each action does to the studio is its own suite's business, and
 * this one is about the order they run in and what the modal is told afterwards.
 */
const runConfirmedAction = vi.hoisted(() =>
  vi.fn<(name: ActionName, input: Record<string, unknown>) => Promise<ActionOutcome>>(),
)
vi.mock('@/assistant/executor', () => ({ runConfirmedAction }))

const answer = (fields: Partial<AssistantAnswer> = {}): AssistantAnswer => ({
  say: 'J’ouvre un fichier 3D.',
  calls: [],
  cost: 0.75,
  ...fields,
})

/** The bridge, with the one channel this store speaks on. Returns what the main process saw. */
function brain(...replies: AssistantAnswer[]): { asked: AssistantThought[] } {
  const asked: AssistantThought[] = []
  let turn = 0

  installFakeBridge({
    assistant: {
      think: (request: AssistantThought) => {
        asked.push(request)
        return Promise.resolve(replies[turn++] ?? answer())
      },
    },
  })

  return { asked }
}

beforeEach(() => {
  runConfirmedAction.mockReset()
  runConfirmedAction.mockResolvedValue({ ok: true })
  useAssistant.setState({ open: false, turns: [], busy: false, asked: null, spent: 0 })
})

describe('saying something to the assistant', () => {
  it('keeps what was said and what came back', async () => {
    brain()
    await useAssistant.getState().say('  ouvre un fichier 3D  ')

    const [turn] = useAssistant.getState().turns
    expect(turn?.said).toBe('ouvre un fichier 3D')
    expect(turn?.answered).toBe('J’ouvre un fichier 3D.')
    expect(useAssistant.getState().busy).toBe(false)
  })

  it('carries the turns before it, and never the one being said', async () => {
    const { asked } = brain()
    await useAssistant.getState().say('ouvre un fichier 3D')
    await useAssistant.getState().say('et maintenant génère')

    expect(asked[0]?.history).toEqual([])
    expect(asked[1]?.history).toHaveLength(1)
    expect(asked[1]?.history[0]).toContain('ouvre un fichier 3D')
  })

  /** The whole reason the total is on screen: five turns cost about what one picture does. */
  it('adds up what the thinking cost', async () => {
    brain(answer({ cost: 0.75 }), answer({ cost: 1 }))
    await useAssistant.getState().say('une')
    await useAssistant.getState().say('deux')

    expect(useAssistant.getState().spent).toBe(1.75)
  })

  /**
   * In order, and this is the one that matters: `generator.prepare` fills the form that
   * `generator.submit` then sends, so a plan run at once would send an empty one.
   */
  it('runs the actions one after another, and records what each one did', async () => {
    const order: ActionName[] = []
    runConfirmedAction.mockImplementation(name => {
      order.push(name)
      return Promise.resolve(
        name === 'generator.submit' ? { ok: false, refusal: 'declined' } : { ok: true },
      )
    })

    brain(
      answer({
        calls: [
          { action: 'generator.prepare', input: {} },
          { action: 'generator.submit', input: {} },
        ],
      }),
    )
    await useAssistant.getState().say('génère un casque')

    expect(order).toEqual(['generator.prepare', 'generator.submit'])
    expect(useAssistant.getState().turns[0]?.steps).toEqual([
      { action: 'generator.prepare', refusal: null },
      { action: 'generator.submit', refusal: 'declined' },
    ])
  })

  // Two plans over one generator form, and a question on screen belonging to neither.
  it('ignores a second sentence while the first is still running', async () => {
    let release = (): void => {}
    installFakeBridge({
      assistant: {
        think: () =>
          new Promise<AssistantAnswer>(resolve => {
            release = () => resolve(answer())
          }),
      },
    })

    const first = useAssistant.getState().say('une')
    await useAssistant.getState().say('deux')
    expect(useAssistant.getState().turns).toHaveLength(1)

    release()
    await first
  })

  it('marks a turn that came to nothing, rather than showing an empty answer', async () => {
    brain(answer({ say: '', calls: [], cost: 1.5 }))
    await useAssistant.getState().say('fais quelque chose d’impossible')

    expect(useAssistant.getState().turns[0]?.lost).toBe(true)
    // Spent all the same: the model was asked twice and both attempts were billed.
    expect(useAssistant.getState().spent).toBe(1.5)
  })

  it('says so rather than hanging when the studio does not answer at all', async () => {
    installFakeBridge({ assistant: { think: () => Promise.reject(new Error('closed')) } })
    await useAssistant.getState().say('ouvre un fichier 3D')

    expect(useAssistant.getState().turns[0]?.lost).toBe(true)
    expect(useAssistant.getState().busy).toBe(false)
  })
})

describe('the question asked before anything is engaged', () => {
  // A question nobody can see is not a question — and one may arrive from outside this window.
  it('brings the modal up on its own', async () => {
    const asked = useAssistant.getState().ask({ action: 'generator.submit', commitment: 'credits' })

    expect(useAssistant.getState().open).toBe(true)
    useAssistant.getState().answer(false)
    await expect(asked).resolves.toBe(false)
  })

  /** Left unanswered it would hold `busy` for the rest of the session, and spend nothing ever. */
  it('is declined by closing the modal, never left waiting', async () => {
    const asked = useAssistant.getState().ask({ action: 'generator.submit', commitment: 'credits' })
    useAssistant.getState().hide()

    await expect(asked).resolves.toBe(false)
    expect(useAssistant.getState().open).toBe(false)
    expect(useAssistant.getState().asked).toBeNull()
  })
})
