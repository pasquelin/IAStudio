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
   * Muted at rest and full ink once the row is PICKED, because `muted` carries 3.25:1 on
   * `accent-soft`. Read off `rowSkin`'s group rather than a prop: six sites render a subtitle and
   * none of them knows whether the cell holding it is picked.
   */
  it('lifts its subtitle out of muted once the row is picked', () => {
    render(<Row icon={mdiCube} title="Cube" subtitle="Mesh" />)

    expect(screen.getByText('Mesh')).toHaveClass('text-muted', 'group-data-selected/row:text-text')
  })

  /**
   * The name used to raise one on its own, on the grounds that a row truncates. What that
   * produced was a band repeating a word already under the pointer, over the panel beside it, on
   * every list in the studio.
   */
  it('says nothing under the pointer when the row has nothing the screen does not show', () => {
    render(<Row icon={mdiCube} title="A rather long name" />)

    expect(screen.getByText('A rather long name')).not.toHaveAttribute('data-tooltip-content')
  })

  // The studio tooltip, not the native `title`: the rest of the app is instant and themed.
  it('tips the row where a hint gives it something to say', () => {
    render(<Row icon={mdiCube} title="Cube" hint="Not on your plan" />)

    const name = screen.getByText('Cube')
    expect(name).toHaveAttribute(
      'data-tooltip-content',
      expect.stringContaining('Not on your plan'),
    )
    expect(name).toHaveAttribute('data-tooltip-place', 'right')
  })

  it('follows the placement its list asks for', () => {
    render(<Row icon={mdiCube} title="Cube" hint="Somewhere else" tip={TIP_BOTTOM} />)

    expect(screen.getByText('Cube')).toHaveAttribute('data-tooltip-place', 'bottom')
  })

  it('strikes through what is muted', () => {
    render(<Row icon={mdiCube} title="Cube" muted />)

    expect(screen.getByText('Cube').className).toContain('line-through')
    expect(screen.getByText('Cube').className).toContain('text-muted')
  })

  /**
   * A hidden layer is DIMMED, not disabled — still selectable, renamable, draggable — so its name
   * has to clear AA on the fill the row takes: `muted` reads 3.25:1 on `accent-soft`. The
   * strike-through goes on saying what the pale colour used to say alone.
   *
   * The subtitle got this at iteration 8 and the title did not, four lines apart, under a comment
   * quoting these very numbers.
   */
  it('lifts a muted title on the same state as the subtitle, keeping the strike', () => {
    render(<Row icon={mdiCube} title="Cube" muted />)

    expect(screen.getByText('Cube')).toHaveClass(
      'group-data-selected/row:text-text',
      'line-through',
      // The fill fades under it; without this the word would snap while its background fades.
      // Held here because nothing else does: the subtitle carries its own, four lines below.
      'transition-colors',
    )
  })

  it('leaves a row that is not muted in the reading colour', () => {
    render(<Row icon={mdiCube} title="Cube" />)

    const title = screen.getByText('Cube')
    expect(title.className).toContain('text-text')
    expect(title.className).not.toContain('line-through')
  })

  /**
   * The second line truncates too — « Occlusion ambian… » — and hovering is the only way to read
   * the rest. The NATIVE attribute here, where the name above raises the studio one: a row raising
   * both would answer two different things depending on which half the pointer was over.
   */
  it('keeps its second line readable when the row is too narrow for it', () => {
    render(<Row icon={mdiCube} title="Trajectoire" subtitle="Occlusion ambiante" />)

    expect(screen.getByTitle('Occlusion ambiante')).toBeInTheDocument()
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

  /**
   * What makes the `truncate` on the name fire at all. A flex item defaults to `min-width: auto`,
   * so without this pair the row is as wide as the longest name it holds, whatever the panel
   * measures — and the tree lays its rows out `absolute inset-x-0`, so the fill stops at the panel
   * edge while the text scrolls on past it.
   *
   * jsdom lays nothing out, so the classes are what can be asked for; the defect they close was
   * seen in Electron on 2026-08-14, in the explorer, on a `.glb` named after its asset id.
   */
  it('shrinks inside its host rather than growing to the width of its name', () => {
    const { container } = render(<Row icon={mdiCube} title="A rather long name" />)

    expect(container.firstElementChild).toHaveClass('min-w-0', 'flex-1')
  })
})
