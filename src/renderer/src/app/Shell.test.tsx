import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fake-bridge'
import { useLayouts } from '@/stores/layouts'
import { DEFAULT_OPEN, useTools } from '@/stores/tools'
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
  useLayouts.setState({ activeWorkspace: 'image', layouts: {} })
  useTools.setState({ open: {}, sizes: {}, splits: {} })
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

// Spec § 3: the band belongs to the montage in Video, and the shelf moves to the left column
// so a take can be dragged onto a track.
describe('the Video layout', () => {
  it('puts the montage in the band and the shelf in the left column', () => {
    useLayouts.setState({ activeWorkspace: 'video' })
    useTools.setState({ open: DEFAULT_OPEN })
    renderShell()

    expect(screen.getByLabelText('Timeline')).toBeInTheDocument()
    expect(screen.getByLabelText('Assets')).toBeInTheDocument()
  })

  // Same stored layout, other section: the halves keep their place, their contents follow.
  it('gives the same halves the panels Image puts there', () => {
    useLayouts.setState({ activeWorkspace: 'image' })
    useTools.setState({ open: DEFAULT_OPEN })
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
    useTools.setState({ open: { right: { primary: 'models', secondary: 'inspector' } } })
    renderShell()

    expect(screen.getByLabelText('Modèles')).toBeInTheDocument()
    expect(screen.getByLabelText('Inspecteur')).toBeInTheDocument()
    expect(handles()).toHaveLength(2)
  })
})
