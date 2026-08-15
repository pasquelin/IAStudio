import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PropertySection } from './PropertySection'

describe('PropertySection', () => {
  it('shows its content under its heading', () => {
    render(
      <PropertySection title="Transform">
        <p>fields</p>
      </PropertySection>,
    )

    expect(screen.getByText('fields')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Transform/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  // One heading, two gestures: what a click does depends on where it already stands.
  it('says which of its two gestures a click would do', async () => {
    render(
      <PropertySection title="Transform">
        <p>fields</p>
      </PropertySection>,
    )
    const heading = screen.getByRole('button', { name: /Transform/ })

    expect(heading).toHaveAttribute('data-tooltip-content', 'Replie ce groupe de propriétés')

    await userEvent.click(heading)

    expect(heading).toHaveAttribute('data-tooltip-content', 'Déplie ce groupe de propriétés')
  })

  it('folds and unfolds on its heading', async () => {
    render(
      <PropertySection title="Transform">
        <p>fields</p>
      </PropertySection>,
    )
    const heading = screen.getByRole('button', { name: /Transform/ })

    await userEvent.click(heading)
    expect(screen.queryByText('fields')).not.toBeInTheDocument()
    expect(heading).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(heading)
    expect(screen.getByText('fields')).toBeInTheDocument()
  })

  it('can start folded', () => {
    render(
      <PropertySection title="Material" defaultOpen={false}>
        <p>fields</p>
      </PropertySection>,
    )

    expect(screen.queryByText('fields')).not.toBeInTheDocument()
  })
})
