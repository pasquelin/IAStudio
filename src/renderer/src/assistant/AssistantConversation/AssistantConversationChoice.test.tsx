import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAssistant } from '@/stores/assistant'
import { AssistantConversationChoice } from './AssistantConversationChoice'

const asked = (): Promise<string | null> =>
  useAssistant.getState().askChoice('Dans quel espace ?', ['Image', 'Vidéo', 'Audio'])

const drawn = (): void => {
  const choosing = useAssistant.getState().choosing
  if (choosing) render(<AssistantConversationChoice {...choosing} />)
}

beforeEach(() => useAssistant.setState({ choosing: null }))

describe('a question the model asked', () => {
  /**
   * 🛑 The answer settles the PROMISE the action is waiting on: written into the thread instead,
   * it would cost the person another round of typing before anything moved.
   */
  it('answers the action with what was pressed', async () => {
    const answer = asked()
    drawn()

    await userEvent.click(screen.getByRole('button', { name: 'Vidéo' }))

    await expect(answer).resolves.toBe('Vidéo')
    expect(useAssistant.getState().choosing).toBeNull()
  })

  // Dismissing is an answer too, and the only one that picks nothing on the person's behalf.
  it('answers nothing when the question is dismissed', async () => {
    const answer = asked()
    drawn()

    await userEvent.click(screen.getByRole('button', { name: /tomber/ }))

    await expect(answer).resolves.toBeNull()
  })

  it('offers every choice the model named', () => {
    void asked()
    drawn()

    expect(screen.getAllByRole('button').map(one => one.textContent)).toEqual([
      'Image',
      'Vidéo',
      'Audio',
      'Laisser tomber',
    ])
  })

  // One at a time, and ACROSS the two kinds: two slots blind to each other put two sets of
  // buttons on one thread, and the danger the guard exists for is between them too.
  it('refuses a second question rather than replacing the one on screen', async () => {
    const first = asked()
    const second = useAssistant.getState().askChoice('Autre chose ?', ['Oui'])

    await expect(second).resolves.toBeNull()
    expect(useAssistant.getState().choosing?.question).toBe('Dans quel espace ?')
    useAssistant.getState().choose(null)
    await first
  })

  it('refuses a confirmation while a question of its own stands', async () => {
    const first = asked()

    await expect(
      useAssistant.getState().ask({ action: 'project.create', commitment: 'studio' }),
    ).resolves.toBe(false)
    useAssistant.getState().choose(null)
    await first
  })
})
