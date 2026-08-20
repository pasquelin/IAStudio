import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAutomaticPulls, type AutomaticPulls } from './useAutomaticPulls'

const pulling = (over: Partial<AutomaticPulls> = {}): AutomaticPulls => ({
  key: 'one',
  drawn: 0,
  max: 3,
  fetching: false,
  answered: 0,
  ask: () => {},
  ...over,
})

describe('a listing that pulls on its own while nothing is drawn', () => {
  it('asks again on every answer that left the surface empty, up to its ceiling', () => {
    const ask = vi.fn()
    const { rerender } = renderHook((props: AutomaticPulls) => useAutomaticPulls(props), {
      initialProps: pulling({ ask }),
    })

    for (let answer = 1; answer < 6; answer += 1) rerender(pulling({ ask, answered: answer }))

    expect(ask).toHaveBeenCalledTimes(3)
  })

  it('stops as soon as enough is drawn to fill the surface', () => {
    const ask = vi.fn()
    const { rerender } = renderHook((props: AutomaticPulls) => useAutomaticPulls(props), {
      initialProps: pulling({ ask, drawn: 0, wanted: 2 }),
    })

    rerender(pulling({ ask, drawn: 1, wanted: 2, answered: 1 }))
    rerender(pulling({ ask, drawn: 2, wanted: 2, answered: 2 }))

    expect(ask).toHaveBeenCalledTimes(2)
  })

  // Another account is another library, read from nothing: with the count left where the previous
  // one stopped, the surface would sit empty with no scroll able to fill it.
  it('counts afresh once the listing is asking something else', () => {
    const ask = vi.fn()
    const { rerender } = renderHook((props: AutomaticPulls) => useAutomaticPulls(props), {
      initialProps: pulling({ ask }),
    })
    for (let answer = 1; answer < 4; answer += 1) rerender(pulling({ ask, answered: answer }))

    rerender(pulling({ ask, key: 'two' }))

    expect(ask).toHaveBeenCalledTimes(4)
  })

  it('spends nothing while a page is already on its way', () => {
    const ask = vi.fn()
    renderHook((props: AutomaticPulls) => useAutomaticPulls(props), {
      initialProps: pulling({ ask, fetching: true }),
    })

    expect(ask).not.toHaveBeenCalled()
  })

  it('spends nothing when there is nobody to ask', () => {
    const { rerender } = renderHook((props: AutomaticPulls) => useAutomaticPulls(props), {
      initialProps: pulling({ ask: null }),
    })

    const ask = vi.fn()
    rerender(pulling({ ask, answered: 1 }))

    // The pull it did not spend while nothing could be asked is still there to spend.
    expect(ask).toHaveBeenCalledTimes(1)
  })
})
