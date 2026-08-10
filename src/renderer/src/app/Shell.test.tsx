import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fake-bridge'
import { homeIsVisible, useLayouts } from '@/stores/layouts'
import { useSettings } from '@/stores/settings'
import { arrangedFor } from '@/stores/tool-fixtures'
import {
  arrangementOf,
  DEFAULT_ARRANGEMENTS,
  DEFAULT_OPEN,
  useTools,
  type OpenByZone,
} from '@/stores/tools'
import { HOME_SURFACE } from '@shared/domain/tool'
import { Shell } from './Shell'

vi.mock('./DocumentArea', () => ({ DocumentArea: () => null }))

// The rail carries one button per panel, labelled with the same title as the panel itself. It
// has its own test; here it would only make every query ambiguous.
vi.mock('./Rail', () => ({ Rail: () => null }))

function renderShell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <Shell />
    </QueryClientProvider>,
  )
}

/** Resize handles: a zone's own, plus the divider a zone cut in two puts inside itself. */
function handles(): HTMLElement[] {
  return screen.queryAllByRole('separator')
}

beforeEach(() => {
  installFakeBridge()
  // Every test below is about the docks, which the home covers entirely — see the last block,
  // which is the one that exercises it.
  useLayouts.setState({ activeWorkspace: 'image', layouts: {}, home: false })
  useTools.setState({ arrangements: arrangedFor('image', { open: {}, sizes: {}, splits: {} }) })
  // The store is shared across files: one test turns the home off, and every later one would
  // inherit a studio whose entry point does not exist.
  useSettings.setState(state => ({
    settings: { ...state.settings, home: { ...state.settings.home, enabled: true } },
  }))
})

describe('a horizontal band', () => {
  it('is one surface: the shelf and the zone handle, nothing else', () => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: { bottom: { primary: 'assets' } } }),
    })
    renderShell()

    expect(screen.getByLabelText('Assets')).toBeInTheDocument()
    expect(handles()).toHaveLength(1)
  })

  // No placement declares a second half in a band, but a layout written by an older version
  // can still hold one. It must not draw a panel there.
  it('shows nothing in a second half a stored layout still asks for', () => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: { bottom: { secondary: 'assets' } } }),
    })
    renderShell()

    expect(screen.queryByLabelText('Assets')).not.toBeInTheDocument()
  })

  // The divider is what would leave two panels too narrow to be either — and drawn from a
  // state nothing writes any more, nothing puts it back.
  it('draws no divider inside itself, whatever the stored layout holds', () => {
    useTools.setState({
      arrangements: arrangedFor('image', {
        open: { bottom: { primary: 'assets', secondary: 'assets' } },
      }),
    })
    renderShell()

    expect(screen.getAllByLabelText('Assets')).toHaveLength(1)
    expect(handles()).toHaveLength(1)
  })
})

// What a fresh install shows, and what "Reset layout" restores. The stored layout is the same in
// all six sections; each reads its own first panel into every half.
describe('the default layout', () => {
  it('opens Image on the layers, the inspector, the shelf and the Explorer', () => {
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })
    renderShell()

    expect(screen.getByLabelText('Calques')).toBeInTheDocument()
    expect(screen.getByLabelText('Inspecteur')).toBeInTheDocument()
    expect(screen.getByLabelText('Assets')).toBeInTheDocument()
    // The lower half of the left column, open like every other half a surface has: two halves of
    // two exist so the generator stays visible WHILE the Explorer is read.
    expect(screen.getByLabelText('Explorateur')).toBeInTheDocument()
    // Its half shows the first panel it declares, so the Apps wait one click away.
    expect(screen.queryByLabelText('Apps')).not.toBeInTheDocument()
  })

  it('opens Video on the montage and the shelf beside it', () => {
    useLayouts.setState({ activeWorkspace: 'video' })
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })
    renderShell()

    expect(screen.getByLabelText('Timeline')).toBeInTheDocument()
    expect(screen.getByLabelText('Assets')).toBeInTheDocument()
  })

  it('opens Skyboxes on the sky controls', () => {
    useLayouts.setState({ activeWorkspace: 'skyboxes' })
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })
    renderShell()

    expect(screen.getByLabelText('Skybox')).toBeInTheDocument()
  })
})

// Spec § 3: the band belongs to the montage in Video, and the shelf moves to the right column
// so a take can be dragged onto a track.
describe('the Video layout', () => {
  // One stored layout, read by two sections: the halves keep their place, their contents follow.
  const SHELF_IN_COLUMN: OpenByZone = {
    ...DEFAULT_OPEN.workspaces,
    right: { primary: 'assets', secondary: 'inspector' },
  }

  it('puts the montage in the band and the shelf in the right column', () => {
    useLayouts.setState({ activeWorkspace: 'video' })
    useTools.setState({ arrangements: arrangedFor('image', { open: SHELF_IN_COLUMN }) })
    renderShell()

    expect(screen.getByLabelText('Timeline')).toBeInTheDocument()
    expect(screen.getByLabelText('Assets')).toBeInTheDocument()
  })

  it('gives the same halves the panels Image puts there', () => {
    useLayouts.setState({ activeWorkspace: 'image' })
    useTools.setState({ arrangements: arrangedFor('image', { open: SHELF_IN_COLUMN }) })
    renderShell()

    expect(screen.getByLabelText('Assets')).toBeInTheDocument()
    expect(screen.getByLabelText('Calques')).toBeInTheDocument()
    expect(screen.queryByLabelText('Timeline')).not.toBeInTheDocument()
  })
})

describe('a side column', () => {
  // The cut a band refuses is exactly what a column is for: two panels stacked, and a divider
  // to share the height between them.
  it('keeps both halves and the divider between them', () => {
    useTools.setState({
      arrangements: arrangedFor('image', {
        open: { right: { primary: 'layers', secondary: 'inspector' } },
      }),
    })
    renderShell()

    expect(screen.getByLabelText('Calques')).toBeInTheDocument()
    expect(screen.getByLabelText('Inspecteur')).toBeInTheDocument()
    expect(handles()).toHaveLength(2)
  })

  // A lone half fills its zone: the divider belongs to the cut, and there is none to make here.
  it('draws no divider where only one half of a column is open', () => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: { left: { primary: 'models' } } }),
    })
    renderShell()

    expect(screen.getByLabelText('Modèles')).toBeInTheDocument()
    expect(handles()).toHaveLength(1)
  })
})

describe('the home', () => {
  /**
   * Two columns and no band: the montage and the asset strip act on an open document, and the
   * home has none. Those zones are not drawn, so neither are their rails.
   */
  it('draws its two columns and neither band', () => {
    useLayouts.setState({ home: true })
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })
    renderShell()

    expect(screen.queryByLabelText('Calques')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Assets')).not.toBeInTheDocument()
    // Three dividers: one per column, and the cut between the right column's two halves. The
    // zones that would carry a fourth are absent.
    expect(handles()).toHaveLength(3)
  })

  /**
   * Its panels open where panels open — under a rail icon, in a tool window that closes and
   * reopens like the others. What an unchosen half draws is the first panel the registry puts
   * there, which is why no arrangement here names one.
   */
  it('opens on the projects, what was made, and the journal', () => {
    useLayouts.setState({ home: true })
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })
    renderShell()

    expect(screen.getByLabelText('Vos projets')).toBeInTheDocument()
    expect(screen.getByLabelText('Ce que vous avez produit')).toBeInTheDocument()
    expect(screen.getByLabelText('Activité récente')).toBeInTheDocument()
    // The spaces' own two, which no placement gives this surface.
    expect(screen.queryByLabelText('Modèles')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Explorateur')).not.toBeInTheDocument()
  })

  /**
   * The other three of the right column's upper half take turns with what is open there: a half
   * shows ONE panel at a time. The rail is how one swaps them, and it has its own suite — this
   * file mocks it away so that a title queried here can only be a panel.
   */
  it('shows one panel per half, never the whole upper right at once', () => {
    useLayouts.setState({ home: true })
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })
    renderShell()

    for (const name of ['Par type', 'Votre bibliothèque', 'Vos documents']) {
      expect(screen.queryByLabelText(name)).not.toBeInTheDocument()
    }
  })

  // The status line is the studio's global view — jobs, activity, updates — and the home is
  // where a global view is most wanted, not least.
  /**
   * The two cuts a surface with two columns has: the one between a column and the centre, and
   * the one between a column's two halves. Both write to the arrangement of the surface being
   * looked at — the home writes the home's, never the workspaces'.
   *
   * jsdom implements neither pointer capture nor layout, so the capture is stubbed and the
   * measured container reads zero: what is under test is which store each handle writes to, not
   * the arithmetic, which `fitZoneSize` and `fitSplit` own and are tested on directly.
   */
  it('resizes its own zones and its own split, and writes them to the home', () => {
    useLayouts.setState({ home: true })
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })
    Element.prototype.setPointerCapture = vi.fn()
    renderShell()

    // The right column carries both: its own handle, and the divider between its two halves.
    for (const handle of handles()) {
      fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, clientY: 300 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 340, clientY: 260 })
    }

    const home = arrangementOf(useTools.getState(), HOME_SURFACE)
    expect(home.sizes.left).toBeDefined()
    expect(home.sizes.right).toBeDefined()
    expect(home.splits.right).toBeDefined()
    // The spaces' own arrangement is untouched: the two families never share a drag.
    expect(arrangementOf(useTools.getState(), 'image').sizes).toEqual({})
  })

  it('keeps the status line under it', () => {
    useLayouts.setState({ home: true })
    renderShell()

    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('gives back the workspace and its panels when it is left', () => {
    useLayouts.setState({ home: true })
    useTools.setState({
      arrangements: arrangedFor('image', { open: { right: { primary: 'layers' } } }),
    })
    const { rerender } = renderShell()

    useLayouts.setState({ home: false })
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <Shell />
      </QueryClientProvider>,
    )

    expect(screen.getByLabelText('Calques')).toBeInTheDocument()
  })

  it('takes the home button out of the bar when the setting turns it off', () => {
    useSettings.setState(state => ({
      settings: { ...state.settings, home: { ...state.settings.home, enabled: false } },
    }))
    useLayouts.setState({ home: true })
    useTools.setState({
      arrangements: arrangedFor('image', { open: { right: { primary: 'layers' } } }),
    })
    renderShell()

    expect(screen.queryByRole('button', { name: 'Accueil' })).not.toBeInTheDocument()
    // And the studio is on its workspace rather than on a home nothing can reach.
    expect(screen.getByLabelText('Calques')).toBeInTheDocument()
  })
})

/**
 * `home` starts true on every launch — it is session state, deliberately not persisted. The
 * setting is what decides whether that means anything, and every reader has to ask the same
 * question: the native menu asked a different one and published its context as if the home
 * were up while the docks were on screen.
 */
describe('who is in front', () => {
  it('answers the same to the shell and to the native menu', () => {
    useSettings.setState(state => ({
      settings: { ...state.settings, home: { ...state.settings.home, enabled: false } },
    }))
    useLayouts.setState({ home: true })

    expect(homeIsVisible()).toBe(false)

    useSettings.setState(state => ({
      settings: { ...state.settings, home: { ...state.settings.home, enabled: true } },
    }))

    expect(homeIsVisible()).toBe(true)
  })
})
