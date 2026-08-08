import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PromptSuggestion } from '@shared/domain/prompt-assist'
import { PromptSuggestions, type PromptSuggestionsProps } from './PromptSuggestions'

const SUGGESTION: PromptSuggestion = {
  text: 'Photorealistic close-up of a mossy boulder',
  parameters: { resolution: '4K', numOutputs: 2 },
}

function draw(overrides: Partial<PromptSuggestionsProps> = {}) {
  const props: PromptSuggestionsProps = {
    readDraft: () => 'a boulder',
    request: () => Promise.resolve([SUGGESTION]),
    onAdoptText: vi.fn(),
    onAdoptCall: vi.fn(),
    failureMessage: () => 'Trop de requêtes.',
    ...overrides,
  }

  render(<PromptSuggestions {...props} />)
  return props
}

const suggest = (): HTMLElement => screen.getByRole('button', { name: 'Proposer des variantes' })

describe('prompt suggestions, drawn', () => {
  it('asks for nothing until it is asked to', () => {
    const request = vi.fn(() => Promise.resolve([]))
    draw({ request })

    expect(request).not.toHaveBeenCalled()
  })

  it('sends the draft as it stands at the moment of the click', async () => {
    const request = vi.fn(() => Promise.resolve([]))
    let draft = 'a boulder'
    draw({ request, readDraft: () => draft })

    draft = 'a mossy boulder'
    await userEvent.click(suggest())

    expect(request).toHaveBeenCalledWith('a mossy boulder')
  })

  it('shows what came back', async () => {
    draw()

    await userEvent.click(suggest())

    expect(await screen.findByText(/Photorealistic close-up/)).toBeInTheDocument()
  })

  it('shows the settings a variant carries', async () => {
    draw()

    await userEvent.click(suggest())

    expect(await screen.findByText(/resolution 4K/)).toBeInTheDocument()
    expect(screen.getByText(/numOutputs 2/)).toBeInTheDocument()
  })

  // The prompt is already the text above; repeating it as a setting reads as a second one.
  it('leaves the prompt out of the settings summary', async () => {
    draw({
      request: () =>
        Promise.resolve([
          { text: 'a rewritten prompt', parameters: { prompt: 'a rewritten prompt' } },
        ]),
    })

    await userEvent.click(suggest())

    await screen.findByText('a rewritten prompt')
    expect(screen.queryByText(/prompt a rewritten/)).not.toBeInTheDocument()
  })

  it('adopts the text alone on the first action', async () => {
    const onAdoptText = vi.fn()
    const onAdoptCall = vi.fn()
    draw({ onAdoptText, onAdoptCall })

    await userEvent.click(suggest())
    await userEvent.click(await screen.findByRole('button', { name: 'Utiliser le texte' }))

    expect(onAdoptText).toHaveBeenCalledWith(SUGGESTION.text)
    expect(onAdoptCall).not.toHaveBeenCalled()
  })

  it('adopts the settings only when asked for both', async () => {
    const onAdoptText = vi.fn()
    const onAdoptCall = vi.fn()
    draw({ onAdoptText, onAdoptCall })

    await userEvent.click(suggest())
    await userEvent.click(await screen.findByRole('button', { name: 'Texte + réglages' }))

    expect(onAdoptCall).toHaveBeenCalledWith(SUGGESTION)
    expect(onAdoptText).not.toHaveBeenCalled()
  })

  // Nothing to adopt beyond the text: the second button would promise settings there are none of.
  it('offers only the text when the variant carries no setting', async () => {
    draw({ request: () => Promise.resolve([{ text: 'a rewritten prompt', parameters: {} }]) })

    await userEvent.click(suggest())

    expect(await screen.findByRole('button', { name: 'Utiliser le texte' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Texte + réglages' })).not.toBeInTheDocument()
  })

  it('shows the rationale when the API gave one', async () => {
    draw({
      request: () => Promise.resolve([{ ...SUGGESTION, rationale: 'macro reads the moss best' }]),
    })

    await userEvent.click(suggest())

    expect(await screen.findByText('macro reads the moss best')).toBeInTheDocument()
  })

  it('says what went wrong rather than staying silent', async () => {
    draw({ request: () => Promise.reject(new Error('rate-limited')) })

    await userEvent.click(suggest())

    expect(await screen.findByRole('status')).toHaveTextContent('Trop de requêtes.')
  })

  // An empty answer is not a failure, and must not read as one.
  it('distinguishes an empty answer from a refused one', async () => {
    draw({ request: () => Promise.resolve([]) })

    await userEvent.click(suggest())

    expect(await screen.findByRole('status')).toHaveTextContent('Aucune variante proposée.')
  })

  it('drops what a previous answer showed when the next one fails', async () => {
    let answer = (): Promise<PromptSuggestion[]> => Promise.resolve([SUGGESTION])
    draw({ request: () => answer() })

    await userEvent.click(suggest())
    await screen.findByText(/Photorealistic close-up/)

    answer = () => Promise.reject(new Error('rate-limited'))
    await userEvent.click(suggest())

    await waitFor(() =>
      expect(screen.queryByText(/Photorealistic close-up/)).not.toBeInTheDocument(),
    )
  })

  it('cannot be asked twice while it is still answering', async () => {
    const request = vi.fn(() => new Promise<PromptSuggestion[]>(() => {}))
    draw({ request })

    await userEvent.click(suggest())
    expect(suggest()).toBeDisabled()

    await userEvent.click(suggest())
    expect(request).toHaveBeenCalledTimes(1)
  })
})
