import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type Settings } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fake-bridge'
import { useSettings } from '@/stores/settings'
import { SettingsWindow } from './SettingsWindow'

describe('SettingsWindow', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the settings the window it opened from never shared with it', async () => {
    const read = vi.fn((): Promise<Settings> =>
      Promise.resolve({
        ...DEFAULT_SETTINGS,
        appearance: { theme: 'dark', density: 'compact' },
      }),
    )
    installFakeBridge({ settings: { read } })

    render(<SettingsWindow />)

    expect(read).toHaveBeenCalled()
    await waitFor(() => expect(useSettings.getState().settings.appearance.density).toBe('compact'))
  })

  // The CSS gauges hang off `[data-density]`: without it the compact mode does not exist.
  it('publishes the density on its own document', async () => {
    installFakeBridge()
    render(<SettingsWindow />)

    await waitFor(() => expect(document.documentElement.dataset['density']).toBeDefined())
  })

  it('shows the account section', () => {
    installFakeBridge()
    render(<SettingsWindow />)

    expect(screen.getByRole('heading', { name: 'Connexion à Scenario' })).toBeInTheDocument()
  })
})
