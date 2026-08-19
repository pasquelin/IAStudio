import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChoiceField, type Choice } from './ChoiceField'

const OPTIONS: readonly Choice<'a' | 'b'>[] = [
  { value: 'a', label: 'First', hint: 'Picks the first' },
  { value: 'b', label: 'Second', hint: 'Picks the second' },
]

describe('a row of choices', () => {
  it('presses the one that is on, and only it', () => {
    render(<ChoiceField label="Mode" value="a" options={OPTIONS} onChange={() => {}} />)

    expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Second' })).toHaveAttribute('aria-pressed', 'false')
  })

  // What a panel shows for a value none of the rows names — a world nobody's preset matches.
  it('presses nothing at all when the value is none of them', () => {
    render(<ChoiceField label="Mode" value={null} options={OPTIONS} onChange={() => {}} />)

    for (const option of OPTIONS) {
      expect(screen.getByRole('button', { name: option.label })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    }
  })

  it('hands back the value that was picked', async () => {
    const onChange = vi.fn()
    render(<ChoiceField label="Mode" value="a" options={OPTIONS} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Second' }))

    expect(onChange).toHaveBeenCalledWith('b')
  })
})
