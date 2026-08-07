import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  type PartialSettings,
  type Settings,
  type SettingsSectionId,
} from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fake-bridge'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settings-draft'
import { SettingsWindow } from './SettingsWindow'

function navigation(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Sections de réglages' })
}

describe('SettingsWindow', () => {
  beforeEach(() => {
    useSettingsDraft.setState({ pending: {}, touched: new Set() })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the settings the window it opened from never shared with it', async () => {
    const read = vi.fn((): Promise<Settings> =>
      Promise.resolve({
        ...DEFAULT_SETTINGS,
        appearance: { ...DEFAULT_SETTINGS.appearance, density: 'compact' },
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

    expect(screen.getByRole('heading', { name: 'Général' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Langue/)).toBeInTheDocument()
  })

  it('opens on the section the fragment names', () => {
    window.location.hash = '#settings/media'
    installFakeBridge()
    render(<SettingsWindow />)

    expect(screen.getByRole('heading', { name: 'Médias' })).toBeInTheDocument()
    window.location.hash = ''
  })

  // Already open, on another section: reloading it would throw away a half-typed key.
  it('moves to the section asked for while it is already open', async () => {
    let announce: ((section: SettingsSectionId) => void) | null = null
    installFakeBridge({
      settings: {
        onSection: callback => {
          announce = callback
          return () => {}
        },
      },
    })

    render(<SettingsWindow />)
    expect(screen.getByRole('heading', { name: 'Général' })).toBeInTheDocument()

    act(() => announce?.('appearance'))
    await waitFor(() => expect(screen.getByLabelText(/Thème/)).toBeInTheDocument())
  })

  it('lists the families a generation can be configured for', () => {
    installFakeBridge()
    render(<SettingsWindow />)

    const entries = within(navigation()).getAllByRole('button')
    expect(entries.map(entry => entry.textContent)).toEqual([
      'Général',
      'Compte',
      'Apparence',
      'Génération',
      'Image',
      'Vidéo',
      '3D',
      'Audio',
      'Agrandissement',
      'Espaces de travail',
      '3D',
      'Raccourcis',
      'Médias',
    ])
  })

  it('shows the section the user picks, and only that one', async () => {
    installFakeBridge()
    render(<SettingsWindow />)

    await userEvent.click(within(navigation()).getByRole('button', { name: 'Apparence' }))

    expect(screen.getByLabelText(/Thème/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Clé API/)).not.toBeInTheDocument()
  })

  it('writes nothing until Apply is asked for', async () => {
    const write = vi.fn((): Promise<Settings> => Promise.resolve(DEFAULT_SETTINGS))
    installFakeBridge({ settings: { write } })

    render(<SettingsWindow />)
    await userEvent.click(within(navigation()).getByRole('button', { name: 'Apparence' }))
    await userEvent.selectOptions(screen.getByLabelText(/Densité/), 'compact')

    expect(write).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Appliquer' }))

    expect(write).toHaveBeenCalledWith({ appearance: { density: 'compact' } })
  })

  it('drops what was staged when the change is cancelled', async () => {
    const write = vi.fn((): Promise<Settings> => Promise.resolve(DEFAULT_SETTINGS))
    installFakeBridge({ settings: { write } })

    render(<SettingsWindow />)
    await userEvent.click(within(navigation()).getByRole('button', { name: 'Apparence' }))
    await userEvent.selectOptions(screen.getByLabelText(/Densité/), 'compact')
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(write).not.toHaveBeenCalled()
    // Back to what is stored, which is what "cancel" has to mean for the control too.
    expect(screen.getByLabelText(/Densité/)).toHaveValue('comfortable')
  })

  // A window that shows Apply and Cancel with nothing waiting reads as a form to submit.
  it('shows no buttons while nothing is waiting', () => {
    installFakeBridge()
    render(<SettingsWindow />)

    expect(screen.queryByRole('button', { name: 'Appliquer' })).not.toBeInTheDocument()
  })

  // What a list of sections cannot do: a user knows what they want, not which tab holds it.
  it('finds a setting by what it does, wherever it lives', async () => {
    installFakeBridge()
    render(<SettingsWindow />)

    await userEvent.type(screen.getByLabelText('Rechercher un réglage'), 'réseau')

    expect(screen.getByLabelText(/Tentatives maximum/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Clé API/)).not.toBeInTheDocument()
  })

  it('says which section a result came from', async () => {
    installFakeBridge()
    render(<SettingsWindow />)

    await userEvent.type(screen.getByLabelText('Rechercher un réglage'), 'ffmpeg')

    expect(screen.getByRole('heading', { name: 'Médias' })).toBeInTheDocument()
  })

  it('says so when nothing matches, rather than showing an empty page', async () => {
    installFakeBridge()
    render(<SettingsWindow />)

    await userEvent.type(screen.getByLabelText('Rechercher un réglage'), 'crénage')

    expect(screen.getByText(/Aucun réglage ne correspond/)).toBeInTheDocument()
  })

  // A panel sends the user here to show them something; results over it would hide it.
  it('drops the search when a panel asks for a section', async () => {
    const listeners: ((section: SettingsSectionId) => void)[] = []
    installFakeBridge({
      settings: {
        onSection: callback => {
          listeners.push(callback)
          return () => {}
        },
      },
    })

    render(<SettingsWindow />)
    await userEvent.type(screen.getByLabelText('Rechercher un réglage'), 'thème')

    act(() => listeners[0]?.('account'))

    expect(screen.getByLabelText(/Clé API/)).toBeInTheDocument()
    expect(screen.getByLabelText('Rechercher un réglage')).toHaveValue('')
  })

  it('drops the search when a section is picked, so the two never disagree', async () => {
    installFakeBridge()
    render(<SettingsWindow />)

    await userEvent.type(screen.getByLabelText('Rechercher un réglage'), 'thème')
    await userEvent.click(within(navigation()).getByRole('button', { name: 'Compte' }))

    expect(screen.getByLabelText(/Clé API/)).toBeInTheDocument()
    expect(screen.getByLabelText('Rechercher un réglage')).toHaveValue('')
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

    // Staged like every other setting rather than written on the spot: this screen goes
    // through the buffer too, so it cannot slip past Apply on its own.
    expect(written).toEqual([])
    expect(useSettingsDraft.getState().pending).toEqual({
      generation: { defaultModels: { image: 'model_flux' } },
    })

    await userEvent.selectOptions(picker, '')
    // Absence of a key, not an empty model id — which the main process would reject.
    expect(useSettingsDraft.getState().pending).toEqual({ generation: { defaultModels: {} } })

    await userEvent.click(screen.getByRole('button', { name: 'Appliquer' }))
    expect(written.at(-1)).toEqual({ generation: { defaultModels: {} } })
  })
})
