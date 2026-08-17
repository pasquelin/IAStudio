import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CloudAsset, CloudPage } from '@shared/domain/cloudAsset'
import { withQueries } from '@/app/query-fixtures'
import { useCloudPages } from './useCloudPages'

function cloudAsset(id: string): CloudAsset {
  return {
    id,
    name: id,
    type: 'image',
    remoteType: 'txt2img',
    ownerId: 'proj_1',
    createdAt: '2026-08-12T11:00:00.000Z',
    updatedAt: '2026-08-12T11:00:00.000Z',
    privacy: 'private',
    tags: [],
    collectionIds: [],
  }
}

function Listing({
  read,
  enabled,
}: {
  read: (from: { cursor?: string }) => Promise<CloudPage> | undefined
  enabled?: boolean
}) {
  const { assets, exhausted, pending, more } = useCloudPages(['listing'], read, enabled)

  return (
    <>
      <span data-testid="ids">{assets.map(asset => asset.id).join(',')}</span>
      <span data-testid="state">{pending ? 'pending' : exhausted ? 'exhausted' : 'open'}</span>
      <button type="button" onClick={more}>
        more
      </button>
    </>
  )
}

const idsOf = (): string => screen.getByTestId('ids').textContent ?? ''

describe('a cloud listing read page by page', () => {
  it('appends the next page to the ones already read', async () => {
    const read = ({ cursor }: { cursor?: string }) =>
      Promise.resolve(
        cursor
          ? { assets: [cloudAsset('c')], cursor: null }
          : { assets: [cloudAsset('a'), cloudAsset('b')], cursor: 'o:2' },
      )

    render(withQueries(<Listing read={read} />))
    await screen.findByText('a,b')

    await userEvent.click(screen.getByRole('button'))

    expect(await screen.findByText('a,b,c')).toBeInTheDocument()
  })

  /**
   * These listings page by offset over something that keeps growing: an asset created between
   * two requests shifts everything down one, and the tile at the boundary comes back.
   */
  it('shows an asset once, however many pages repeat it', async () => {
    const read = ({ cursor }: { cursor?: string }) =>
      Promise.resolve(
        cursor
          ? { assets: [cloudAsset('b'), cloudAsset('c')], cursor: null }
          : { assets: [cloudAsset('a'), cloudAsset('b')], cursor: 'o:2' },
      )

    render(withQueries(<Listing read={read} />))
    await screen.findByText('a,b')

    await userEvent.click(screen.getByRole('button'))

    expect(await screen.findByText('a,b,c')).toBeInTheDocument()
  })

  /**
   * The offset stops advancing at its ceiling and the API answers the same page for ever. Read as
   * « there is more », that is an unbounded loop of identical searches, each one billed.
   */
  it('is at its end when the cursor stops advancing', async () => {
    const read = vi.fn(() => Promise.resolve({ assets: [cloudAsset('a')], cursor: 'o:10000' }))

    render(withQueries(<Listing read={read} />))
    await screen.findByText('a')
    await userEvent.click(screen.getByRole('button'))
    await screen.findByText('exhausted')

    // The first page, then the one that came back on the same cursor. Never a third.
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('is at its end after a run of pages bringing nothing new', async () => {
    let offset = 0
    const read = vi.fn(() => {
      offset += 1
      return Promise.resolve({ assets: [cloudAsset('a')], cursor: `o:${offset}` })
    })

    render(withQueries(<Listing read={read} />))
    await screen.findByText('a')
    for (let click = 0; click < 5; click += 1) await userEvent.click(screen.getByRole('button'))

    expect(await screen.findByText('exhausted')).toBeInTheDocument()
    expect(read.mock.calls.length).toBeLessThanOrEqual(5)
  })

  it('is at its end as soon as a page comes back without a cursor', async () => {
    render(
      withQueries(
        <Listing read={() => Promise.resolve({ assets: [cloudAsset('a')], cursor: null })} />,
      ),
    )

    expect(await screen.findByText('exhausted')).toBeInTheDocument()
  })

  // Neither « empty » nor « finished »: a shelf that told them apart would say a project holds
  // nothing while the first page is still on its way.
  it('says it is still waiting on its first page', () => {
    render(withQueries(<Listing read={() => new Promise(() => {})} />))

    expect(screen.getByTestId('state')).toHaveTextContent('pending')
  })

  it('reads nothing at all while it is not enabled', () => {
    const read = vi.fn(() => Promise.resolve({ assets: [], cursor: null }))

    render(withQueries(<Listing read={read} enabled={false} />))

    expect(read).not.toHaveBeenCalled()
    expect(idsOf()).toBe('')
  })

  // No bridge is an answer: there is nothing to ask, and nothing more to wait for.
  it('settles when the caller has nothing to ask', async () => {
    render(withQueries(<Listing read={() => undefined} />))

    expect(await screen.findByText('exhausted')).toBeInTheDocument()
  })
})
