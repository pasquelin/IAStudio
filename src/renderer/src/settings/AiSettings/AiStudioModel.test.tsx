import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { useSettings } from '@/stores/settings'
import { AiStudioModel } from './AiStudioModel'

describe('the studio’s own model', () => {
  beforeEach(() => {
    installFakeBridge()
    useSettings.setState({ settings: DEFAULT_SETTINGS })
  })

  /**
   * The two screens offer the SAME choice: without this the manager could pick Scenario and never
   * say which of its four answered, while the modal could — and the hint promised otherwise.
   */
  it('writes the setting the assistant’s own window writes', async () => {
    const write = vi.fn(async () => {})
    useSettings.setState({ write })
    render(<AiStudioModel />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'claude-opus-4-8')

    expect(write).toHaveBeenCalledWith({ assistant: { model: 'claude-opus-4-8' } })
  })
})
