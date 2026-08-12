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

  /**
   * Muted at rest and full ink on the two states a row takes, because `muted` carries 3.25:1 on
   * `accent-soft` and 3.51 on `elevated`. Read off `rowSkin`'s group rather than a prop: six
   * sites render a subtitle and none of them knows whether the cell holding it is picked.
   */
  it('lifts its subtitle out of muted once the row is picked or pointed at', () => {
    render(<Row icon={mdiCube} title="Cube" subtitle="Mesh" />)

    expect(screen.getByText('Mesh')).toHaveClass(
      'text-muted',
      'group-hover/row:text-text',
      'group-data-selected/row:text-text',
    )
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
    expect(screen.getByText('Cube').className).toContain('text-muted')
  })

  /**
   * A hidden layer is DIMMED, not disabled — still selectable, renamable, draggable — so its name
   * has to clear AA on the fills the row takes: `muted` reads 3.51:1 on `elevated` and 3.25 on
   * `accent-soft`. The strike-through goes on saying what the pale colour used to say alone.
   *
   * The subtitle got this at iteration 8 and the title did not, four lines apart, under a comment
   * quoting these very numbers.
   */
  it('lifts a muted title on the same two states as the subtitle, keeping the strike', () => {
    render(<Row icon={mdiCube} title="Cube" muted />)

    expect(screen.getByText('Cube')).toHaveClass(
      'group-hover/row:text-text',
      'group-data-selected/row:text-text',
      'line-through',
    )
  })

  it('leaves a row that is not muted in the reading colour', () => {
    render(<Row icon={mdiCube} title="Cube" />)

    const title = screen.getByText('Cube')
    expect(title.className).toContain('text-text')
    expect(title.className).not.toContain('line-through')
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
