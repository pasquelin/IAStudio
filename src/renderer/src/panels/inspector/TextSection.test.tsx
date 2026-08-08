import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_FONT, type FontRef } from '@shared/domain/font'
import type { TextDescriptor } from '@shared/domain/scene'
import { installFakeBridge } from '@/services/fake-bridge'
import { TextSection } from './TextSection'

const text: TextDescriptor = {
  value: 'Bonjour',
  font: DEFAULT_FONT,
  size: 1,
  depth: 0.2,
  curveSegments: 6,
}

function show(overrides: Partial<TextDescriptor> = {}) {
  const onChange = vi.fn()
  render(<TextSection text={{ ...text, ...overrides }} onChange={onChange} gesture={{}} />)

  return onChange
}

describe('the text section', () => {
  it('shows what the node says, and writes back what is typed', async () => {
    installFakeBridge({})
    const onChange = show()

    const field = screen.getByLabelText('Contenu')
    expect(field).toHaveValue('Bonjour')

    await userEvent.type(field, '!')

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value: 'Bonjour!' }))
  })

  it('lists the numbers that shape the letters', () => {
    installFakeBridge({})
    show()

    expect(screen.getByLabelText('Corps')).toBeInTheDocument()
    expect(screen.getByLabelText('Segments de courbe')).toBeInTheDocument()
  })

  // The face the document names is offered whether or not this machine has it: dropping it from
  // the list would silently rewrite the document on the very next edit.
  it('marks a face this machine has not got rather than dropping it', async () => {
    installFakeBridge({ fonts: { list: async () => [] } })
    const missing: FontRef = { source: 'system', family: 'Futura' }
    show({ font: missing })

    expect(await screen.findByText('Futura (absente)')).toBeInTheDocument()
  })

  it('names the face plainly when the machine does have it', async () => {
    installFakeBridge({ fonts: { list: async () => ['Futura'] } })
    show({ font: { source: 'system', family: 'Futura' } })

    expect(await screen.findByText('Futura')).toBeInTheDocument()
  })
})
