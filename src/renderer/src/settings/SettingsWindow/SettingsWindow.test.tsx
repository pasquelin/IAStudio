import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  type PartialSettings,
  type Settings,
  type SettingsSectionId,
} from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
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

  /**
   * The window renders its own React tree: `TooltipHost` living in the shell reached none of
   * it, so every tooltip attribute written here pointed at an id nothing answered. Hovering is
   * the only assertion that says the host is mounted — a closed `<Tooltip>` renders nothing.
   */
  it('mounts the shared tooltip, which its own tree would otherwise lack', async () => {
    installFakeBridge()
    render(<SettingsWindow />)

    const restore = screen.getAllByRole('button', { name: /Restaurer/ })[0]
    await userEvent.hover(restore!)

    await waitFor(() => expect(restore).toHaveAttribute('aria-describedby'))
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
      'Détourage',
      'Vectorisation',
      'Espaces de travail',
      '3D',
      'Raccourcis',
      'Dictée',
      'Médias',
      'Stockage',
      'Avancé',
    ])
  })

  // Written in `rem` until the 11th of August, this column answered the root element that the
  // sheet never sizes: it held 16 px a level in both densities, alone among the studio's trees.
  it('indents a sub-section by the density gauge rather than a fixed step', () => {
    installFakeBridge()
    render(<SettingsWindow />)

    const entries = within(navigation()).getAllByRole('button')
    const root = entries.find(entry => entry.textContent === 'Génération')
    const child = entries.find(entry => entry.textContent === 'Vidéo')

    expect(root?.style.paddingLeft).toContain('var(--sc-indent)')
    expect(child?.style.paddingLeft).toContain('var(--sc-indent)')
    expect(child?.style.paddingLeft).not.toEqual(root?.style.paddingLeft)
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

  /**
   * "Annuler", "Appliquer", "OK" — three words for three different fates of the same buffer,
   * and only one of them closes the window. The face of the bar cannot say which.
   */
  it('tells its three fates apart, which the words alone do not', async () => {
    installFakeBridge()
    render(<SettingsWindow />)
    await userEvent.click(within(navigation()).getByRole('button', { name: 'Apparence' }))
    await userEvent.selectOptions(screen.getByLabelText(/Densité/), 'compact')

    const contents = (name: string): string | null =>
      screen.getByRole('button', { name }).getAttribute('data-tooltip-content')

    expect(contents('Annuler')).toBe('Abandonne les changements en attente, sans fermer la fenêtre')
    expect(contents('Appliquer')).toBe(
      'Écrit les changements maintenant, et laisse la fenêtre ouverte',
    )
    expect(contents('OK')).toBe('Écrit les changements, puis ferme la fenêtre')
  })

  // The dot beside a section is the only sign that changes wait there; the sentence names it.
  it('says why a section is marked, rather than only marking it', async () => {
    installFakeBridge()
    render(<SettingsWindow />)
    const appearance = within(navigation()).getByRole('button', { name: 'Apparence' })
    expect(appearance).toHaveAttribute(
      'data-tooltip-content',
      'Affiche les réglages de cette section',
    )

    await userEvent.click(appearance)
    await userEvent.selectOptions(screen.getByLabelText(/Densité/), 'compact')

    expect(within(navigation()).getByRole('button', { name: 'Apparence' })).toHaveAttribute(
      'data-tooltip-content',
      'Cette section a des changements non appliqués',
    )
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

  // Closing on a pending buffer would throw the work away in silence; the main process is what
  // asks, and it has no other way to know.
  it('tells the main process when it is holding changes nobody applied', async () => {
    const setPending = vi.fn(() => Promise.resolve())
    installFakeBridge({ settings: { setPending } })

    render(<SettingsWindow />)
    await userEvent.click(within(navigation()).getByRole('button', { name: 'Apparence' }))
    await userEvent.selectOptions(screen.getByLabelText(/Densité/), 'compact')

    expect(setPending).toHaveBeenLastCalledWith(true)

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(setPending).toHaveBeenLastCalledWith(false)
  })

  // What a list of sections cannot do: a user knows what they want, not which tab holds it.
  it('finds a setting by what it does, wherever it lives', async () => {
    installFakeBridge()
    render(<SettingsWindow />)

    await userEvent.type(screen.getByLabelText('Rechercher un réglage'), 'réseau')

    expect(screen.getByLabelText(/Tentatives maximum/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Clé API/)).not.toBeInTheDocument()
  })

  it('says which section a result came from, and goes there when asked', async () => {
    installFakeBridge()
    render(<SettingsWindow />)

    await userEvent.type(screen.getByLabelText('Rechercher un réglage'), 'ffmpeg')
    // The section name is the way there: knowing where a setting lives is half the answer.
    // Taken from the results, not the navigation, which lists the same name.
    await userEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Médias' }))

    expect(screen.getByRole('heading', { name: 'Médias' })).toBeInTheDocument()
  })

  // The window is three registries, and a search finding only the sliders sends people hunting
  // through tabs for the button or the shortcut they came for.
  it('finds a button and a shortcut, not only a setting', async () => {
    installFakeBridge()
    render(<SettingsWindow />)

    await userEvent.type(screen.getByLabelText('Rechercher un réglage'), 'réinitialiser')

    expect(screen.getByText('Tout réinitialiser')).toBeInTheDocument()
    expect(screen.getByText('Réinitialiser la disposition')).toBeInTheDocument()
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

  /**
   * A default the plan cannot run is a generation that fails every time the generator opens,
   * with nothing on this screen having said so. A native `<option>` carries no tooltip, so the
   * reason is suffixed onto the label — greying a name out silently is the failure to avoid.
   */
  it('refuses a default model the plan does not cover, and says so in its label', async () => {
    installFakeBridge({
      // Without a key there is no plan to read, and nothing is greyed out — which is the whole
      // point of the fallback, and would make this case pass on the wrong reason.
      settings: { authState: () => Promise.resolve({ authenticated: true }) },
      scenario: {
        searchModels: () =>
          Promise.resolve({
            items: [
              {
                id: 'model_seedance',
                name: 'Seedance 2.0',
                family: 'image',
                source: 'scenario',
                origin: 'official',
                featured: false,
                capabilities: ['txt2img'],
                tags: [],
                requiredPlanLevel: 50,
              },
            ],
            cursor: null,
          }),
        plan: () => Promise.resolve({ name: 'cu-basic', level: 25 }),
      },
    })

    render(<SettingsWindow />)
    await userEvent.click(within(navigation()).getByRole('button', { name: 'Image' }))

    const option = await screen.findByRole('option', { name: /Seedance 2\.0/ })
    expect(option).toBeDisabled()
    expect(option).toHaveTextContent('Hors abonnement')
  })

  /**
   * The default ALREADY stored, which nobody is choosing right now — a downgrade or an account
   * switch puts it out of plan on its own. A browser still shows a disabled `<option>` as the
   * selected one, and the suffix lives only in the option labels, so without this the screen
   * says nothing and the generator opens armed on a model that fails on every submission.
   */
  it('warns when the default already stored has fallen out of the plan', async () => {
    installFakeBridge({
      settings: {
        read: () =>
          Promise.resolve({
            ...DEFAULT_SETTINGS,
            generation: { ...DEFAULT_SETTINGS.generation, defaultModels: { image: 'model_pro' } },
          }),
        authState: () => Promise.resolve({ authenticated: true }),
      },
      scenario: {
        searchModels: () =>
          Promise.resolve({
            items: [
              {
                id: 'model_pro',
                name: 'Seedance 2.0',
                family: 'image',
                source: 'scenario',
                origin: 'official',
                featured: false,
                capabilities: ['txt2img'],
                tags: [],
                requiredPlanLevel: 50,
              },
            ],
            cursor: null,
          }),
        plan: () => Promise.resolve({ name: 'cu-basic', level: 25 }),
      },
    })

    render(<SettingsWindow />)
    await userEvent.click(within(navigation()).getByRole('button', { name: 'Image' }))

    expect(await screen.findByText(/cu-basic/)).toBeInTheDocument()
  })

  /**
   * The search field sat inside the column that scrolls, at `w-full`. Two things followed from
   * that: the scrollbar took its width out of the field, so it narrowed and widened as the list
   * grew past the window; and it scrolled away with the sections it filters.
   *
   * jsdom lays nothing out, so what is checked is the structure that decides it: the field is
   * outside whatever scrolls, and the list is inside it.
   */
  describe('the search field', () => {
    const field = (): HTMLElement => screen.getByLabelText('Rechercher un réglage')

    it('sits outside the part that scrolls, so a scrollbar never resizes it', () => {
      installFakeBridge()
      render(<SettingsWindow />)

      const scrollers = field().closest('[class*="overflow-auto"]')
      expect(scrollers).toBeNull()
    })

    it('leaves the sections themselves free to scroll under it', () => {
      installFakeBridge()
      render(<SettingsWindow />)

      // The outermost one: the nested sections carry lists of their own.
      const [list] = within(screen.getByRole('navigation')).getAllByRole('list')
      expect(list?.closest('[class*="overflow-auto"]')).not.toBeNull()
    })
  })
})
