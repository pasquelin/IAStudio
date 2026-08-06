import { mdiCursorDefaultOutline, mdiPencil } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar, type Tool } from './Toolbar'

const TOOLS: Tool[] = [
  { id: 'select', labelKey: 'actions.close', icon: mdiCursorDefaultOutline, shortcut: 'V' },
  { id: 'brush', labelKey: 'actions.generate', icon: mdiPencil, shortcut: 'B' },
]

describe('Toolbar', () => {
  it('rend un bouton par outil et signale celui qui est actif', () => {
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

  it('remonte l’outil choisi', async () => {
    const onTool = vi.fn()
    render(<Toolbar tools={TOOLS} onTool={onTool} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer (V)' }))
    expect(onTool).toHaveBeenCalledWith('select')
  })

  it('masque une section passée à false', () => {
    render(<Toolbar tools={TOOLS} onTool={vi.fn()} sections={{ tools: false }} />)
    expect(screen.queryByRole('button', { name: 'Générer (B)' })).not.toBeInTheDocument()
  })

  it('remplace une section par le nœud fourni', () => {
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

  it('n’affiche annuler et rétablir que si les rappels existent', () => {
    const { rerender } = render(<Toolbar tools={TOOLS} onTool={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument()

    rerender(<Toolbar tools={TOOLS} onTool={vi.fn()} onUndo={vi.fn()} canUndo />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeEnabled()
  })

  it('désactive annuler quand la pile est vide', () => {
    render(<Toolbar tools={TOOLS} onTool={vi.fn()} onUndo={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeDisabled()
  })

  it('déclare son orientation', () => {
    render(<Toolbar tools={TOOLS} onTool={vi.fn()} orientation="horizontal" />)
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-orientation', 'horizontal')
  })
})
