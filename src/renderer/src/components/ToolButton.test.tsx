import { mdiPencil } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TIP_TOP } from '@/helpers/tooltip'
import { ToolButton } from './ToolButton'

describe('ToolButton', () => {
  it('names the button with its shortcut, and tips the same words', () => {
    render(<ToolButton icon={mdiPencil} label="Brush" shortcut="B" tooltip={TIP_TOP} />)

    const button = screen.getByRole('button', { name: 'Brush (B)' })
    expect(button).toHaveAttribute('data-tooltip-content', 'Brush (B)')
  })

  // An icon-only button whose action is never spelled out is one to press to find out.
  it('always carries a tooltip, since the factory is not optional', () => {
    render(<ToolButton icon={mdiPencil} label="Brush" tooltip={TIP_TOP} />)

    expect(screen.getByRole('button', { name: 'Brush' })).toHaveAttribute('data-tooltip-id')
  })

  /**
   * 🛑 The tone goes with the button being pressable. A disabled control still wearing its
   * colour reads as available — and the scene transport's whole reading is « the coloured one
   * is the one to press », Stop staying inert until there is a game to end.
   */
  it('paints the tone it is given, and drops it while inert', () => {
    const { unmount } = render(<ToolButton label="Play" tone="success" tooltip={TIP_TOP} />)
    expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('text-success')
    unmount()

    render(<ToolButton label="Stop" tone="danger" disabled tooltip={TIP_TOP} />)
    expect(screen.getByRole('button', { name: 'Stop' })).not.toHaveClass('text-danger')
  })

  it('exposes its active state to assistive technologies', () => {
    render(<ToolButton label="Select" active tooltip={TIP_TOP} />)
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true')
  })

  /**
   * 🛑 Only where BOTH are drawn: a square button holds one glyph and needs no gap, and the
   * journal's filters read « ⩸Niveau » with the two touching.
   */
  it('spaces a glyph from the words beside it, and only then', () => {
    const { unmount } = render(
      <ToolButton icon={mdiPencil} label="Niveau" tooltip={TIP_TOP}>
        <span>Niveau</span>
      </ToolButton>,
    )
    expect(screen.getByRole('button', { name: 'Niveau' })).toHaveClass('gap-1.5')
    unmount()

    render(<ToolButton icon={mdiPencil} label="Brush" tooltip={TIP_TOP} />)
    expect(screen.getByRole('button', { name: 'Brush' })).not.toHaveClass('gap-1.5')
  })

  it('renders its children when no icon is provided', () => {
    render(
      <ToolButton label="Color" tooltip={TIP_TOP}>
        <span data-testid="preview" />
      </ToolButton>,
    )
    expect(screen.getByTestId('preview')).toBeInTheDocument()
  })
})
