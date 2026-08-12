import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PromptSuggestion } from '@shared/domain/prompt-assist'
import { installFakeBridge } from '@/services/fake-bridge'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { settleHome } from '@/home/home-fixtures'
import { Spark } from './Spark'

const IDEA: PromptSuggestion = {
  text: 'a mossy stone bridge at dawn',
  parameters: { prompt: 'a mossy stone bridge at dawn', numInferenceSteps: 30 },
}

function install(suggestions: readonly PromptSuggestion[] = [IDEA]) {
  const suggestPrompts = vi.fn(() => Promise.resolve([...suggestions]))
  installFakeBridge({ scenario: { suggestPrompts } })
  return { suggestPrompts }
}

beforeEach(() => {
  settleHome()
  useSettings.setState({ auth: { authenticated: true, ownerId: 'team_1' } })
  useModels.setState({ selected: { image: 'model_flux' }, preset: {}, prepared: null })
})

describe('the spark panel', () => {
  it('asks for nothing until somebody presses the button', () => {
    // It is the one panel of this column that would call the API on arrival if left to itself,
    // and a home that fires a round trip per launch spends the account's rate limit on a panel
    // nobody looked at.
    const { suggestPrompts } = install()
    render(<Spark />)

    expect(suggestPrompts).not.toHaveBeenCalled()
    expect(screen.getByText(/aucune unité créative/)).toBeInTheDocument()
  })

  it('writes the ideas for the model the generator would open on', async () => {
    const { suggestPrompts } = install()
    render(<Spark />)

    await userEvent.click(screen.getByRole('button', { name: 'Proposez-moi une idée' }))

    await waitFor(() =>
      expect(suggestPrompts).toHaveBeenCalledWith(
        expect.objectContaining({ modelId: 'model_flux' }),
      ),
    )
    expect(await screen.findByText('a mossy stone bridge at dawn')).toBeInTheDocument()
  })

  /**
   * The idea card wears the docks' neutral fill rather than a copy of it — the ink included, which
   * is why the prose inside no longer names a colour of its own. The site test rather than the
   * shared guard alone: that one refuses a re-copy, this one says the card is still filled.
   */
  it('fills an idea with the docks own neutral skin, ink and all', async () => {
    install()
    render(<Spark />)

    await userEvent.click(screen.getByRole('button', { name: 'Proposez-moi une idée' }))

    const card = (await screen.findByText('a mossy stone bridge at dawn')).closest('button')
    expect(card).toHaveClass('bg-surface')
    expect(card).toHaveClass('text-text')
    expect(card).toHaveClass('hover:bg-elevated')
  })

  it('carries the settings the API proposed into the generator', async () => {
    install()
    render(<Spark />)
    await userEvent.click(screen.getByRole('button', { name: 'Proposez-moi une idée' }))

    await userEvent.click(await screen.findByRole('button', { name: /Ouvrir le générateur/ }))

    // Prepared on both the prompt and the settings: nothing has to be retyped.
    expect(useModels.getState().preset.image).toMatchObject({ numInferenceSteps: 30 })
  })

  /**
   * The endpoint conditions on the model; asking without one proposes into the void. As a band
   * it drew nothing at all, which a panel may not do — it says what it is waiting for instead,
   * and what it waits for is a choice made in another panel entirely.
   */
  it('says what it is waiting for when no model is chosen', () => {
    install()
    useModels.setState({ selected: {} })
    render(<Spark />)

    expect(screen.getByText(/Choisissez un modèle d’image/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Proposez-moi une idée' })).not.toBeInTheDocument()
  })

  it('keeps the button when the key is refused', async () => {
    const suggestPrompts = vi.fn(() => Promise.reject(new Error('missing')))
    installFakeBridge({ scenario: { suggestPrompts } })
    render(<Spark />)

    await userEvent.click(screen.getByRole('button', { name: 'Proposez-moi une idée' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Proposez-moi une idée' })).toBeEnabled(),
    )
  })
})
