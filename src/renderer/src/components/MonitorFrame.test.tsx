import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MonitorFrame } from './MonitorFrame'

describe('MonitorFrame', () => {
  // The order is the guarantee: a role line painted over the surface, or above the bar, reads as
  // a caption of the wrong half — which is what four hand-written shells would eventually do.
  it('puts the role line last, under the bar rather than over the surface', () => {
    const { container } = render(
      <MonitorFrame role="Source" toolbar={<button type="button">Lire</button>}>
        <canvas />
      </MonitorFrame>,
    )

    const parts = [...(container.firstElementChild?.children ?? [])]

    expect(parts.at(0)).toContainElement(container.querySelector('canvas'))
    expect(parts.at(-2)).toContainElement(screen.getByRole('button', { name: 'Lire' }))
    expect(parts.at(-1)).toHaveTextContent('Source')
  })
})
