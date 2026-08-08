import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToolWindow } from './ToolWindow'

// A tool that cannot render, which no real one does on demand. Its own file because `vi.mock`
// is hoisted over the whole module, and the other ToolWindow tests need the real registry.
vi.mock('./tool-components', () => ({
  TOOL_COMPONENTS: {
    assets: {
      Content: () => {
        throw new Error('tool exploded')
      },
    },
    // Renders its content fine, but its header actions do not.
    layers: {
      Content: () => <p>layer list</p>,
      Actions: () => {
        throw new Error('actions exploded')
      },
    },
    explorer: {
      Content: () => <p>explorer tree</p>,
      Actions: () => <p>explorer actions</p>,
    },
  },
}))

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a panel whose tool throws', () => {
  it('keeps its header, so the panel can still be closed', () => {
    render(<ToolWindow tool="assets" zone="left" onFocus={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Retirer le module' })).toBeInTheDocument()
    expect(screen.getByText('Ce panneau a rencontré une erreur.')).toBeInTheDocument()
  })

  it('does not take the rest of the window with it', () => {
    render(
      <div>
        <ToolWindow tool="assets" zone="left" onFocus={vi.fn()} onClose={vi.fn()} />
        <p>the rest of the studio</p>
      </div>,
    )

    expect(screen.getByText('the rest of the studio')).toBeInTheDocument()
  })
})

describe('a half switched to another tool', () => {
  it('does not hand the failure of the last tool to the next one', () => {
    const { rerender } = render(
      <ToolWindow tool="assets" zone="left" onFocus={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByText('Ce panneau a rencontré une erreur.')).toBeInTheDocument()

    // What the rail does: same element, another tool. The boundary must not survive it.
    rerender(<ToolWindow tool="layers" zone="left" onFocus={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('layer list')).toBeInTheDocument()
    expect(screen.queryByText('Ce panneau a rencontré une erreur.')).not.toBeInTheDocument()
  })

  it('gives the next tool its actions back, even if the last one lost them', () => {
    const { rerender } = render(
      <ToolWindow tool="layers" zone="left" onFocus={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.queryByText('explorer actions')).not.toBeInTheDocument()

    rerender(<ToolWindow tool="explorer" zone="left" onFocus={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('explorer actions')).toBeInTheDocument()
  })
})

describe('a panel whose header actions throw', () => {
  it('drops the actions and keeps both the content and the close button', () => {
    render(<ToolWindow tool="layers" zone="left" onFocus={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('layer list')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retirer le module' })).toBeInTheDocument()
    // The content is fine, so the panel must not claim otherwise.
    expect(screen.queryByText('Ce panneau a rencontré une erreur.')).not.toBeInTheDocument()
  })
})
