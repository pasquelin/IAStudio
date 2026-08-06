import { mdiPencil } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { simpleTooltip } from './tooltip'
import { ToolButton } from './ToolButton'

describe('ToolButton', () => {
  it('names the button with its shortcut even without a tooltip', () => {
    render(<ToolButton icon={mdiPencil} label="Brush" shortcut="B" />)
    expect(screen.getByRole('button', { name: 'Brush (B)' })).toBeInTheDocument()
  })

  it('keeps the same naming with a tooltip', () => {
    render(<ToolButton icon={mdiPencil} label="Brush" shortcut="B" tooltip={simpleTooltip()} />)
    expect(screen.getByRole('button', { name: 'Brush (B)' })).toBeInTheDocument()
  })

  it('exposes its active state to assistive technologies', () => {
    render(<ToolButton label="Select" active />)
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders its children when no icon is provided', () => {
    render(
      <ToolButton label="Color">
        <span data-testid="preview" />
      </ToolButton>,
    )
    expect(screen.getByTestId('preview')).toBeInTheDocument()
  })
})
