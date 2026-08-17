import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WINDOW_CAPTION } from '@/design/windowStyles'
import { report } from '../usage-fixtures'
import { UsageActivities } from './UsageActivities'

/**
 * The table showed the names the API uses — `images-generation` in a French window, and `video`
 * a few pixels under a `Vidéo` the bundle had known all along.
 */
/**
 * The Usage window and the Settings say a secondary line the same way, and neither imports
 * the other: the classes live in one module, read here rather than copied.
 */
describe('the sentence a window says beside its figures', () => {
  it('dresses an empty period as every other window caption', () => {
    // The shared fixture describes a month that spent; emptiness is what this case is about.
    render(<UsageActivities report={report({ actions: [], assets: [] })} />)

    expect(screen.getByText('Aucune activité sur cette période.')).toHaveClass(WINDOW_CAPTION)
  })
})

describe('the names the usage report counts under', () => {
  it('says an action in the language of the window', () => {
    render(
      <UsageActivities
        report={report({ actions: [{ label: 'images-generation', count: 48, units: 612 }] })}
      />,
    )

    expect(screen.getByText('Génération d’images')).toBeDefined()
    expect(screen.queryByText('images-generation')).toBeNull()
  })

  it('says an asset kind too, rather than leaving the API word beside a translated one', () => {
    render(<UsageActivities report={report({ assets: [{ label: 'video', count: 4 }] })} />)

    expect(screen.getByText('Vidéo')).toBeDefined()
  })

  // Scenario adds usage names without notice, and a raw name reads better than a raw key.
  it('shows a name nobody has translated as the API sent it', () => {
    render(
      <UsageActivities report={report({ actions: [{ label: 'holodeck', count: 1, units: 2 }] })} />,
    )

    expect(screen.getByText('holodeck')).toBeDefined()
  })
})
