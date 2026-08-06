import { mdiCursorDefaultOutline, mdiPencil } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar, type Tool } from './Toolbar'

// The expected labels below are French because they come from the i18n bundle: they are
// user-facing text, not identifiers.
const TOOLS: Tool[] = [
  { id: 'select', labelKey: 'actions.close', icon: mdiCursorDefaultOutline, shortcut: 'V' },
  { id: 'brush', labelKey: 'actions.generate', icon: mdiPencil, shortcut: 'B' },
]

describe('Toolbar', () => {
  it('renders one button per tool and flags the active one', () => {
    render(<Toolbar tools={TOOLS} activeTool="brush" onTool={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Générer (B)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Fermer (V)' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('reports the chosen tool', async () => {
    const onTool = vi.fn()
    render(<Toolbar tools={TOOLS} onTool={onTool} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer (V)' }))
    expect(onTool).toHaveBeenCalledWith('select')
  })

  it('hides a section set to false', () => {
    render(<Toolbar tools={TOOLS} onTool={vi.fn()} sections={{ tools: false }} />)
    expect(screen.queryByRole('button', { name: 'Générer (B)' })).not.toBeInTheDocument()
  })

  it('replaces a section with the node provided', () => {
    render(
      <Toolbar
        tools={TOOLS}
        onTool={vi.fn()}
        sections={{ tools: <span data-testid="replacement" /> }}
      />,
    )
    expect(screen.getByTestId('replacement')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Générer (B)' })).not.toBeInTheDocument()
  })

  it('shows undo and redo only when the callbacks exist', () => {
    const { rerender } = render(<Toolbar tools={TOOLS} onTool={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument()

    rerender(<Toolbar tools={TOOLS} onTool={vi.fn()} onUndo={vi.fn()} canUndo />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeEnabled()
  })

  it('disables undo when the stack is empty', () => {
    render(<Toolbar tools={TOOLS} onTool={vi.fn()} onUndo={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeDisabled()
  })

  it('declares its orientation', () => {
    render(<Toolbar tools={TOOLS} onTool={vi.fn()} orientation="horizontal" />)
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-orientation', 'horizontal')
  })
})
