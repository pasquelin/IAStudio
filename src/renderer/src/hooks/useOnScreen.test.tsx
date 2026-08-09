import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { installIntersectionObserver } from '@/test-setup'
import { useOnScreen } from './useOnScreen'

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
    installIntersectionObserver({ eager: false })
    render(<Probe />)

    expect(screen.getByText('waiting')).toBeInTheDocument()
  })

  it('latches as soon as the element comes into view', () => {
    const { reveal } = installIntersectionObserver({ eager: false })
    render(<Probe />)

    act(() => reveal())
    expect(screen.getByText('seen')).toBeInTheDocument()
  })

  it('takes a window that cannot say what is on screen at its word', () => {
    // Rather than deferring for ever: work that never runs is worse than work run too early.
    Reflect.deleteProperty(globalThis, 'IntersectionObserver')
    render(<Probe />)

    expect(screen.getByText('seen')).toBeInTheDocument()
  })
})
