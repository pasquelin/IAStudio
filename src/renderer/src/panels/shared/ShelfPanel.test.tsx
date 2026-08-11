import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ShelfState } from '@/hooks/use-shelf'
import { ShelfPanel } from './ShelfPanel'

const picture = { id: 'asset-1', name: 'boulder.png' }

function shelf(state: ShelfState, items: readonly (typeof picture)[] = [], onRetry = vi.fn()) {
  render(
    <ShelfPanel
      tool="creations"
      items={items}
      state={state}
      onRetry={onRetry}
      renderCard={item => <span>{item.name}</span>}
      empty="Rien de produit ici."
    />,
  )
  return onRetry
}

describe('the frame a shelf panel draws', () => {
  /**
   * A refusal is the one state that offers to try again: `ready` covers "nothing to show" as
   * much as "here it is", and a panel taking itself off the page on either is the failure the
   * shared frame exists to make impossible in both panels at once.
   */
  it('stays on the page when the read was refused, and offers to try again', async () => {
    const onRetry = shelf('refused')

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('says the panel own words when the read came back with nothing', () => {
    shelf('ready')

    expect(screen.getByText('Rien de produit ici.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  /**
   * The name comes from the tool rather than from the caller, so a panel cannot end up announcing
   * something other than what its rail button says. No role on the container is deliberate — the
   * tiles carry the click, and `Collection` gives one only to a grid that picks or opens.
   */
  it('draws the cards under the name the rail gives the tool', () => {
    shelf('ready', [picture])

    expect(screen.getByLabelText('Ce que vous avez produit')).toBeInTheDocument()
    expect(screen.getByText('boulder.png')).toBeInTheDocument()
  })
})
