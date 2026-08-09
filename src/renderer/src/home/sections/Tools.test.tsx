import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { settleHome } from '../home-fixtures'
import { useSettings } from '@/stores/settings'
import { Tools } from './Tools'

describe('Tools', () => {
  beforeEach(() => {
    settleHome()
    useSettings.setState({ settings: structuredClone(DEFAULT_SETTINGS) })
  })

  /**
   * The home draws the same spaces as the title bar. Reordering one of them alone would leave
   * two answers to "what comes first" on one screen, which is why both read the same hook.
   */
  it('follows the order the bar was dragged into', () => {
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, workspaces: { order: ['audio', 'image'] } },
    })

    render(<Tools />)

    const spaces = screen
      .getAllByRole('button')
      .map(button => button.textContent ?? '')
      .filter(label => label.startsWith('Audio') || label.startsWith('Image'))

    expect(spaces[0]?.startsWith('Audio')).toBe(true)
  })
})
