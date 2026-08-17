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
import { withQueries } from '../query-fixtures'
import { Shell } from './Shell'

vi.mock('../DocumentArea', () => ({ DocumentArea: () => null }))

// The rail carries one button per panel, labelled with the same title as the panel itself. It
// has its own test; here it would only make every query ambiguous.
vi.mock('../Rail/Rail', () => ({ Rail: () => null }))

function renderShell() {
  return render(withQueries(<Shell />))
}

/** Resize handles: a zone's own, plus the divider a zone cut in two puts inside itself. */
function handles(): HTMLElement[] {
  return screen.queryAllByRole('separator')
}

beforeEach(() => {
  installFakeBridge()
  // Every test below is about the docks, which the home covers entirely — see the last block,
  // which is the one that exercises it.
  useLayouts.setState({ activeWorkspace: 'image', layout: null, home: false })
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
    // The lower half of the left column, open like every other half a surface has: two halves
    // exist so the generator stays visible WHILE the Explorer is read.
    expect(screen.getByLabelText('Explorateur')).toBeInTheDocument()
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

/** Both halves of one column open — the only shape in which a half can be told from its neighbour. */
const COLUMN_OF_TWO = { right: { primary: 'layers', secondary: 'inspector' } } satisfies OpenByZone

describe('a side column', () => {
  // The cut a band refuses is exactly what a column is for: two panels stacked, and a divider
  // to share the height between them.
  it('keeps both halves and the divider between them', () => {
    useTools.setState({ arrangements: arrangedFor('image', { open: COLUMN_OF_TWO }) })
    renderShell()

    expect(screen.getByLabelText('Calques')).toBeInTheDocument()
    expect(screen.getByLabelText('Inspecteur')).toBeInTheDocument()
    expect(handles()).toHaveLength(2)
  })

  /**
   * The close button of a docked panel, which is the only way out of a half that the rail cannot
   * offer — and it has to shut the half it belongs to rather than the one above it. Both halves
   * are asserted from one arrangement: `Edge` builds a closing handler per half, and a single
   * one of them proves nothing about the other.
   */
  it('closes the half whose button was pressed, and leaves the other standing', () => {
    useTools.setState({ arrangements: arrangedFor('image', { open: COLUMN_OF_TWO }) })
    renderShell()

    const [upper, lower] = screen.getAllByRole('button', { name: 'Retirer le module' })
    if (!upper || !lower) throw new Error('both halves must draw a close button')

    fireEvent.click(lower)

    expect(screen.getByLabelText('Calques')).toBeInTheDocument()
    expect(screen.queryByLabelText('Inspecteur')).not.toBeInTheDocument()

    fireEvent.click(upper)

    expect(screen.queryByLabelText('Calques')).not.toBeInTheDocument()
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

  /**
   * The same, from the other half — reached by closing the upper one, which leaves the lower
   * alone in the column. It then takes the whole zone rather than the length the divider gave
   * it, and there is no divider left to read that length from. The home was the surface that
   * exercised this by default until its left column was cut in two.
   */
  it('gives the whole column to a lower half left on its own', () => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: { right: { secondary: 'inspector' } } }),
    })
    renderShell()

    expect(screen.getByLabelText('Inspecteur')).toBeInTheDocument()
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
    // TWO dividers, one per column — where a workspace has four. A column split needs both halves
    // populated, and since 13 August the home has no `secondary` anywhere: a handle drawn there
    // would drag a cut with nothing on the far side of it.
    expect(handles()).toHaveLength(2)
  })

  /**
   * Its panels open where panels open — under a rail icon, in a tool window that closes and
   * reopens like the others. What an unchosen half draws is the first panel the registry puts
   * there, which is why no arrangement here names one.
   */
  it('opens on the projects and on the library', () => {
    useLayouts.setState({ home: true })
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })
    renderShell()

    // The upper left, which the home alone gives to something other than generation.
    expect(screen.getByLabelText('Vos projets')).toBeInTheDocument()
    expect(screen.getByLabelText('Votre bibliothèque')).toBeInTheDocument()
    // Gone with the eight readings of the studio that came down on 13 August.
    expect(screen.queryByLabelText('Ce que vous avez produit')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Activité récente')).not.toBeInTheDocument()
    // The spaces' own two, which no placement gives this surface.
    expect(screen.queryByLabelText('Modèles')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Explorateur')).not.toBeInTheDocument()
  })

  /**
   * The documents take their turn with the library in the one half the right column has: a half
   * shows ONE panel at a time. The rail is how one swaps them, and it has its own suite — this
   * file mocks it away so that a title queried here can only be a panel.
   */
  it('shows one panel per half, never the whole right column at once', () => {
    useLayouts.setState({ home: true })
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })
    renderShell()

    expect(screen.queryByLabelText('Vos documents')).not.toBeInTheDocument()
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
  it('resizes its own zones and writes them to the home', () => {
    useLayouts.setState({ home: true })
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })
    Element.prototype.setPointerCapture = vi.fn()
    renderShell()

    for (const handle of handles()) {
      fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, clientY: 300 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 340, clientY: 260 })
    }

    const home = arrangementOf(useTools.getState(), HOME_SURFACE)
    expect(home.sizes.left).toBeDefined()
    expect(home.sizes.right).toBeDefined()
    // No split to drag any more, and that is the assertion rather than an omission: the home has
    // one half per column since 13 August, so nothing here writes `splits`.
    expect(home.splits).toEqual({})
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
    rerender(withQueries(<Shell />))

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
