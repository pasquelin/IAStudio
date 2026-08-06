import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type PartialSettings, type Settings } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fake-bridge'
import { useSettings } from '@/stores/settings'
import { SettingsWindow } from './SettingsWindow'

function navigation(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Sections de réglages' })
}

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

  it('opens on the first section and shows it', () => {
    installFakeBridge()
    render(<SettingsWindow />)

    expect(screen.getByRole('heading', { name: 'Compte' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Clé API/)).toBeInTheDocument()
  })

  it('lists the families a generation can be configured for', () => {
    installFakeBridge()
    render(<SettingsWindow />)

    const entries = within(navigation()).getAllByRole('button')
    expect(entries.map(entry => entry.textContent)).toEqual([
      'Compte',
      'Apparence',
      'Génération',
      'Image',
      'Vidéo',
      '3D',
      'Audio',
      'Agrandissement',
    ])
  })

  it('shows the section the user picks, and only that one', async () => {
    installFakeBridge()
    render(<SettingsWindow />)

    await userEvent.click(within(navigation()).getByRole('button', { name: 'Apparence' }))

    expect(screen.getByLabelText(/Thème/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Clé API/)).not.toBeInTheDocument()
  })

  it('writes a change as it is made rather than behind an Apply button', async () => {
    const write = vi.fn((): Promise<Settings> => Promise.resolve(DEFAULT_SETTINGS))
    installFakeBridge({ settings: { write } })

    render(<SettingsWindow />)
    await userEvent.click(within(navigation()).getByRole('button', { name: 'Apparence' }))
    await userEvent.selectOptions(screen.getByLabelText(/Densité/), 'compact')

    expect(write).toHaveBeenCalledWith({ appearance: { density: 'compact' } })
  })

  it('records a default model per family, and forgets it when asked every time', async () => {
    const written: PartialSettings[] = []
    installFakeBridge({
      settings: {
        write: partial => {
          written.push(partial)
          return Promise.resolve(DEFAULT_SETTINGS)
        },
      },
      scenario: {
        searchModels: () =>
          Promise.resolve({
            items: [
              {
                id: 'model_flux',
                name: 'Flux',
                family: 'image',
                source: 'scenario',
                origin: 'official',
                featured: false,
                capabilities: ['txt2img'],
                tags: [],
              },
            ],
            cursor: null,
          }),
      },
    })

    render(<SettingsWindow />)
    await userEvent.click(within(navigation()).getByRole('button', { name: 'Image' }))

    const picker = await screen.findByLabelText(/Modèle par défaut/)
    await userEvent.selectOptions(picker, 'model_flux')
    expect(written.at(-1)).toEqual({ generation: { defaultModels: { image: 'model_flux' } } })

    useSettings.setState(state => ({
      settings: {
        ...state.settings,
        generation: { ...state.settings.generation, defaultModels: { image: 'model_flux' } },
      },
    }))

    await userEvent.selectOptions(picker, '')
    // Absence of a key, not an empty model id — which the main process would reject.
    expect(written.at(-1)).toEqual({ generation: { defaultModels: {} } })
  })
})
