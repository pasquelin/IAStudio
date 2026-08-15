import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EMPTY_STATS, type SceneStats } from '@/engines/scene/scene-stats'
import { SceneCounters } from './SceneCounters'

const scene: SceneStats = {
  triangles: 12_345,
  vertices: 6_789,
  draws: 42,
  textureBytes: 8 * 1024 * 1024,
}

describe('the viewport counters', () => {
  it('says what the scene costs, grouped and in the reader language', () => {
    render(<SceneCounters scene={scene} selected={EMPTY_STATS} />)

    expect(screen.getByRole('rowheader', { name: 'Triangles' })).toBeInTheDocument()
    expect(screen.getByText('12 345')).toBeInTheDocument()
    expect(screen.getByText('8 Mo')).toBeInTheDocument()
  })

  /** A second column only once there is something to compare the whole against. */
  it('leaves out the selection column while nothing is selected', () => {
    const { container } = render(<SceneCounters scene={scene} selected={EMPTY_STATS} />)

    expect(container.querySelectorAll('tr')[0]?.children).toHaveLength(2)
  })

  it('adds the selection beside the whole once something is selected', () => {
    const selected: SceneStats = { triangles: 12, vertices: 24, draws: 1, textureBytes: 0 }
    const { container } = render(<SceneCounters scene={scene} selected={selected} />)

    expect(container.querySelectorAll('tr')[0]?.children).toHaveLength(3)
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  /** It sits over the canvas: a click meant for the model must not land on a read-out. */
  it('takes no pointer of its own', () => {
    const { container } = render(<SceneCounters scene={scene} selected={EMPTY_STATS} />)

    expect(container.firstElementChild).toHaveClass('pointer-events-none')
  })
})
