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

  it('exposes its active state to assistive technologies', () => {
    render(<ToolButton label="Select" active tooltip={TIP_TOP} />)
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true')
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
