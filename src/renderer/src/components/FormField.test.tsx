import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField } from './FormField'

describe('a form field', () => {
  // A `<button>` is labelable like an `<input>`: naming the picker through `htmlFor` is what
  // makes pressing the word open the list, the gesture anyone expects of it.
  it('names the control it points at', () => {
    render(
      <FormField label="Opération" htmlFor="op">
        <button id="op" type="button" />
      </FormField>,
    )

    expect(screen.getByRole('button', { name: 'Opération' })).toBeInTheDocument()
  })

  // 🛑 A `<label>` bound to nothing is announced as a control of its own. What names itself gets
  // plain text instead, and keeps the name it already carries.
  it('draws plain text rather than a label bound to nothing', () => {
    render(
      <FormField label="Modèle">
        <button type="button">SSD-1B</button>
      </FormField>,
    )

    expect(screen.getByRole('button', { name: 'SSD-1B' })).toBeInTheDocument()
    expect(screen.getByText('Modèle').tagName).toBe('SPAN')
  })
})
