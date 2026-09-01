import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { useSettings } from '@/stores/settings'
import { AiCloudModel } from './AiCloudModel'

describe('the model a cloud answers with', () => {
  beforeEach(() => {
    installFakeBridge()
    useSettings.setState({ settings: DEFAULT_SETTINGS })
  })

  /**
   * The cloud's own shows as a PLACEHOLDER, never as the value: prefilled, the field was never
   * empty, and the sentence under it — « laissé vide, le studio prend celui qu'il propose » —
   * described a state one could not reach.
   */
  it('shows the cloud’s own as what an empty field will use', () => {
    render(<AiCloudModel providerId="deepseek" />)

    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'deepseek-chat')
  })

  /** Emptying it means « the one it declares », so the key leaves rather than being stored blank. */
  it('drops the cloud from the settings when the name is cleared', async () => {
    const write = vi.fn(async () => {})
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        assistant: {
          ...DEFAULT_SETTINGS.assistant,
          cloudModels: { openai: 'gpt-5', deepseek: 'deepseek-reasoner' },
        },
      },
      write,
    })
    render(<AiCloudModel providerId="deepseek" />)

    await userEvent.clear(screen.getByRole('textbox'))
    await userEvent.tab()

    expect(write).toHaveBeenCalledWith({ assistant: { cloudModels: { openai: 'gpt-5' } } })
  })

  it('writes the typed name beside the models of the other clouds', async () => {
    const write = vi.fn(async () => {})
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        assistant: { ...DEFAULT_SETTINGS.assistant, cloudModels: { openai: 'gpt-5' } },
      },
      write,
    })
    render(<AiCloudModel providerId="deepseek" />)

    await userEvent.clear(screen.getByRole('textbox'))
    await userEvent.type(screen.getByRole('textbox'), 'deepseek-reasoner')
    await userEvent.tab()

    expect(write).toHaveBeenCalledWith({
      assistant: { cloudModels: { openai: 'gpt-5', deepseek: 'deepseek-reasoner' } },
    })
  })
})
