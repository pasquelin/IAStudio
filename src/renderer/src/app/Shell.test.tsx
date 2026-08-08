import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fake-bridge'
import { useLayouts } from '@/stores/layouts'
import { useSettings } from '@/stores/settings'
import { DEFAULT_OPEN, useTools, type OpenByZone } from '@/stores/tools'
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
  useTools.setState({ open: {}, sizes: {}, splits: {} })
  // The store is shared across files: one test turns the home off, and every later one would
  // inherit a studio whose entry point does not exist.
  useSettings.setState(state => ({
    settings: { ...state.settings, home: { ...state.settings.home, enabled: true } },
  }))
})

describe('a horizontal band', () => {
  it('is one surface: the shelf and the zone handle, nothing else', () => {
    useTools.setState({ open: { bottom: { primary: 'assets' } } })
    renderShell()

    expect(screen.getByLabelText('Assets')).toBeInTheDocument()
    expect(handles()).toHaveLength(1)
  })

  // No placement declares a second half in a band, but a layout written by an older version
  // can still hold one. It must not draw a panel there.
  it('shows nothing in a second half a stored layout still asks for', () => {
    useTools.setState({ open: { bottom: { secondary: 'assets' } } })
    renderShell()

    expect(screen.queryByLabelText('Assets')).not.toBeInTheDocument()
  })

  // The divider is what would leave two panels too narrow to be either — and drawn from a
  // state nothing writes any more, nothing puts it back.
  it('draws no divider inside itself, whatever the stored layout holds', () => {
    useTools.setState({ open: { bottom: { primary: 'assets', secondary: 'assets' } } })
    renderShell()

    expect(screen.getAllByLabelText('Assets')).toHaveLength(1)
    expect(handles()).toHaveLength(1)
  })
})

// What a fresh install shows, and what "Reset layout" restores. The stored layout is the same in
// all six sections; each reads its own first panel into every half.
describe('the default layout', () => {
  it('opens Image on the layers, the inspector and the shelf', () => {
    useTools.setState({ open: DEFAULT_OPEN })
    renderShell()

    expect(screen.getByLabelText('Calques')).toBeInTheDocument()
    expect(screen.getByLabelText('Inspecteur')).toBeInTheDocument()
    expect(screen.getByLabelText('Assets')).toBeInTheDocument()
    expect(screen.queryByLabelText('Explorateur')).not.toBeInTheDocument()
  })

  it('opens Video on the montage and the shelf beside it', () => {
    useLayouts.setState({ activeWorkspace: 'video' })
    useTools.setState({ open: DEFAULT_OPEN })
    renderShell()

    expect(screen.getByLabelText('Timeline')).toBeInTheDocument()
    expect(screen.getByLabelText('Assets')).toBeInTheDocument()
  })

  it('opens Skyboxes on the sky controls', () => {
    useLayouts.setState({ activeWorkspace: 'skyboxes' })
    useTools.setState({ open: DEFAULT_OPEN })
    renderShell()

    expect(screen.getByLabelText('Skybox')).toBeInTheDocument()
  })
})

// Spec § 3: the band belongs to the montage in Video, and the shelf moves to the right column
// so a take can be dragged onto a track.
describe('the Video layout', () => {
  // One stored layout, read by two sections: the halves keep their place, their contents follow.
  const SHELF_IN_COLUMN: OpenByZone = {
    ...DEFAULT_OPEN,
    right: { primary: 'assets', secondary: 'inspector' },
  }

  it('puts the montage in the band and the shelf in the right column', () => {
    useLayouts.setState({ activeWorkspace: 'video' })
    useTools.setState({ open: SHELF_IN_COLUMN })
    renderShell()

    expect(screen.getByLabelText('Timeline')).toBeInTheDocument()
    expect(screen.getByLabelText('Assets')).toBeInTheDocument()
  })

  it('gives the same halves the panels Image puts there', () => {
    useLayouts.setState({ activeWorkspace: 'image' })
    useTools.setState({ open: SHELF_IN_COLUMN })
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
    useTools.setState({ open: { right: { primary: 'layers', secondary: 'inspector' } } })
    renderShell()

    expect(screen.getByLabelText('Calques')).toBeInTheDocument()
    expect(screen.getByLabelText('Inspecteur')).toBeInTheDocument()
    expect(handles()).toHaveLength(2)
  })

  // The left column holds one panel, whichever of the two generation panels it is: no divider
  // to drag, and no half to leave empty.
  it('draws no divider in the left column, which is never cut', () => {
    useTools.setState({ open: { left: { primary: 'models' } } })
    renderShell()

    expect(screen.getByLabelText('Modèles')).toBeInTheDocument()
    expect(handles()).toHaveLength(1)
  })
})

describe('the home', () => {
  it('covers the docks entirely: no rail, no zone, no divider', () => {
    useLayouts.setState({ home: true })
    useTools.setState({ open: DEFAULT_OPEN })
    renderShell()

    expect(screen.queryByLabelText('Calques')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Assets')).not.toBeInTheDocument()
    expect(handles()).toHaveLength(0)
  })

  // The status line is the studio's global view — jobs, activity, updates — and the home is
  // where a global view is most wanted, not least.
  it('keeps the status line under it', () => {
    useLayouts.setState({ home: true })
    renderShell()

    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('gives back the workspace and its panels when it is left', () => {
    useLayouts.setState({ home: true })
    useTools.setState({ open: { right: { primary: 'layers' } } })
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
    useTools.setState({ open: { right: { primary: 'layers' } } })
    renderShell()

    expect(screen.queryByRole('button', { name: 'Accueil' })).not.toBeInTheDocument()
    // And the studio is on its workspace rather than on a home nothing can reach.
    expect(screen.getByLabelText('Calques')).toBeInTheDocument()
  })
})
