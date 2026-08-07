import { mdiCursorDefaultOutline, mdiPencil } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar, type ToolbarItem } from './Toolbar'

// The expected labels below are French because they come from the i18n bundle: they are
// user-facing text, not identifiers.
const TOOLS: ToolbarItem[] = [
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

  it('tips to the side when vertical, so a tooltip never covers the button above', () => {
    render(<Toolbar tools={TOOLS} onTool={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Générer (B)' })).toHaveAttribute(
      'data-tooltip-place',
      'right',
    )
  })

  it('tips above when horizontal', () => {
    render(<Toolbar tools={TOOLS} onTool={vi.fn()} orientation="horizontal" />)
    expect(screen.getByRole('button', { name: 'Générer (B)' })).toHaveAttribute(
      'data-tooltip-place',
      'top',
    )
  })

  it('tips a tool’s description while keeping its name terse', () => {
    const described: ToolbarItem[] = [
      {
        id: 'brush',
        labelKey: 'actions.generate',
        descriptionKey: 'actions.close',
        icon: mdiPencil,
      },
    ]
    render(<Toolbar tools={described} onTool={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Générer' })
    expect(button).toHaveAttribute('data-tooltip-content', 'Fermer')
  })
})

const WITH_MODES: ToolbarItem[] = [
  {
    id: 'eraser',
    labelKey: 'actions.close',
    icon: mdiPencil,
    modes: [
      { id: 'point', labelKey: 'actions.close', icon: mdiPencil },
      { id: 'selection', labelKey: 'actions.generate', icon: mdiPencil },
    ],
  },
]

const SINGLE_MODE: ToolbarItem[] = [
  {
    id: 'eraser',
    labelKey: 'actions.close',
    icon: mdiPencil,
    modes: [{ id: 'point', labelKey: 'actions.close', icon: mdiPencil }],
  },
]

describe('Toolbar modes', () => {
  it('opens the modes of a tool on hover', async () => {
    render(<Toolbar tools={WITH_MODES} onTool={vi.fn()} onMode={vi.fn()} />)
    await userEvent.hover(screen.getByRole('button', { name: 'Fermer' }))
    expect(await screen.findByRole('menu')).toBeInTheDocument()
  })

  it('reports the chosen mode', async () => {
    const onMode = vi.fn()
    render(<Toolbar tools={WITH_MODES} onTool={vi.fn()} onMode={onMode} />)

    await userEvent.hover(screen.getByRole('button', { name: 'Fermer' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Générer' }))
    expect(onMode).toHaveBeenCalledWith('eraser', 'selection')
  })

  it('opens no menu for a tool with a single mode', async () => {
    // One mode is nothing to choose: the button acts directly, as map3D's bar does.
    render(<Toolbar tools={SINGLE_MODE} onTool={vi.fn()} onMode={vi.fn()} />)
    await userEvent.hover(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('still acts on click when the tool has modes', async () => {
    const onTool = vi.fn()
    render(<Toolbar tools={WITH_MODES} onTool={onTool} onMode={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onTool).toHaveBeenCalledWith('eraser')
  })

  it('closes the menu once a mode is chosen', async () => {
    render(<Toolbar tools={WITH_MODES} onTool={vi.fn()} onMode={vi.fn()} />)

    await userEvent.hover(screen.getByRole('button', { name: 'Fermer' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Générer' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
