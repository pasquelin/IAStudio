import { mdiCube } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { Row } from './Row'

describe('Row', () => {
  it('shows the title, and the subtitle when there is one', () => {
    render(<Row icon={mdiCube} title="Cube" subtitle="Mesh" />)

    expect(screen.getByText('Cube')).toBeInTheDocument()
    expect(screen.getByText('Mesh')).toBeInTheDocument()
  })

  // The studio tooltip, not the native `title`: the rest of the app is instant and themed.
  it('tips the row with its own name, since it truncates', () => {
    render(<Row icon={mdiCube} title="A rather long name" />)

    const name = screen.getByText('A rather long name')
    expect(name).toHaveAttribute('data-tooltip-content', 'A rather long name')
    expect(name).toHaveAttribute('data-tooltip-place', 'right')
  })

  it('follows the placement its list asks for', () => {
    render(<Row icon={mdiCube} title="Cube" tip={TIP_BOTTOM} />)

    expect(screen.getByText('Cube')).toHaveAttribute('data-tooltip-place', 'bottom')
  })

  it('strikes through what is muted', () => {
    render(<Row icon={mdiCube} title="Cube" muted />)

    expect(screen.getByText('Cube').className).toContain('line-through')
  })

  it('renders what is handed to leading and to actions', () => {
    render(<Row icon={mdiCube} title="Cube" leading={<i>eye</i>} actions={<i>more</i>} />)

    expect(screen.getByText('eye')).toBeInTheDocument()
    expect(screen.getByText('more')).toBeInTheDocument()
  })

  it('prefers media over icon when both are given', () => {
    render(<Row icon={mdiCube} media={<i>thumb</i>} title="Cube" />)

    expect(screen.getByText('thumb')).toBeInTheDocument()
  })
})
