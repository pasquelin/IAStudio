import { useQuery } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { withQueries } from './query-fixtures'

function Answer({ ask }: { ask: () => Promise<string> }) {
  const { data, status } = useQuery({ queryKey: ['answer'], queryFn: ask })

  return <p>{status === 'success' ? data : status}</p>
}

describe('withQueries', () => {
  /**
   * The reason the five suites configured a client by hand rather than taking the defaults: three
   * more attempts stand between a failing query and the error state they assert on.
   */
  it('lets a failing query fail on its first attempt', async () => {
    const ask = vi.fn(() => Promise.reject(new Error('nope')))

    render(withQueries(<Answer ask={ask} />))

    expect(await screen.findByText('error')).toBeInTheDocument()
    expect(ask).toHaveBeenCalledTimes(1)
  })

  /**
   * A client shared between calls would hand the next test the answer this one fetched — visible
   * as data on the very first render, where a fresh client has nothing yet.
   */
  it('builds a client of its own on each call', async () => {
    const ask = vi.fn(() => Promise.resolve('a kingfisher'))

    const first = render(withQueries(<Answer ask={ask} />))
    expect(await screen.findByText('a kingfisher')).toBeInTheDocument()
    first.unmount()

    render(withQueries(<Answer ask={ask} />))

    expect(screen.getByText('pending')).toBeInTheDocument()
  })
})
