import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useOnScreen } from './useOnScreen'

/**
 * An observer that reports nothing until it is told to — the opposite of the one in
 * `test-setup`, which answers "on screen" straight away because jsdom runs no layout.
 */
function installSilentObserver(): { reveal: () => void } {
  const watching: { observer: Silent; callback: IntersectionObserverCallback; seen: Element[] }[] =
    []

  class Silent {
    private readonly watched: Element[] = []

    constructor(callback: IntersectionObserverCallback) {
      watching.push({ observer: this, callback, seen: this.watched })
    }

    observe(target: Element): void {
      this.watched.push(target)
    }

    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }

    readonly root = null
    readonly rootMargin = ''
    readonly scrollMargin = ''
    readonly thresholds: readonly number[] = []
  }

  globalThis.IntersectionObserver = Silent

  return {
    // Iterated over a snapshot: a callback that mounts something would register another
    // observer, and walking the live list would then never end.
    reveal: () => {
      for (const { observer, callback, seen } of [...watching]) {
        // `as`: an entry has eight fields, and the hook only reads `isIntersecting`.
        const entries = seen.map(
          target => ({ target, isIntersecting: true }) as IntersectionObserverEntry,
        )
        act(() => callback(entries, observer))
      }
    },
  }
}

function Probe() {
  const { ref, seen } = useOnScreen()
  return <div ref={ref}>{seen ? 'seen' : 'waiting'}</div>
}

const REAL = globalThis.IntersectionObserver

afterEach(() => {
  globalThis.IntersectionObserver = REAL
})

describe('waiting for an element to be reached', () => {
  it('says nothing has been seen while nothing has', () => {
    installSilentObserver()
    render(<Probe />)

    expect(screen.getByText('waiting')).toBeInTheDocument()
  })

  it('latches as soon as the element comes into view', () => {
    const { reveal } = installSilentObserver()
    render(<Probe />)

    reveal()
    expect(screen.getByText('seen')).toBeInTheDocument()
  })

  it('takes a window that cannot say what is on screen at its word', () => {
    // Rather than deferring for ever: work that never runs is worse than work run too early.
    Reflect.deleteProperty(globalThis, 'IntersectionObserver')
    render(<Probe />)

    expect(screen.getByText('seen')).toBeInTheDocument()
  })
})
