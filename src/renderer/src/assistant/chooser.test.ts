import { describe, expect, it } from 'vitest'
import { runConfirmedAction } from './executor'
import { registerChooser } from './chooser'

describe('chat.ask', () => {
  /**
   * 🛑 Refused and never awaited where nobody can answer — a headless run, a window with no
   * shell: a question drawn nowhere would hold the chain open until the turn ran out of rounds.
   */
  it('refuses where nobody is there to be asked', async () => {
    await expect(
      runConfirmedAction('chat.ask', { question: 'Which one?', choices: ['a', 'b'] }),
    ).resolves.toEqual({ ok: false, refusal: 'noConfirmer' })
  })

  it('answers the chain what the person pressed', async () => {
    const stop = registerChooser(request => Promise.resolve(request.choices[1] ?? null))

    const outcome = await runConfirmedAction('chat.ask', {
      question: 'Which one?',
      choices: ['Image', 'Vidéo'],
    })

    expect(outcome).toEqual({ ok: true, data: { chosen: 'Vidéo' } })
    stop()
  })

  // A question with nothing to press is not a question — and the model wrote both fields itself.
  it('refuses a question that offers nothing', async () => {
    const stop = registerChooser(() => Promise.resolve(null))

    await expect(
      runConfirmedAction('chat.ask', { question: 'Which one?', choices: [] }),
    ).resolves.toMatchObject({ ok: false, refusal: 'badInput' })
    stop()
  })
})
