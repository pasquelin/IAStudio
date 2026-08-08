import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('panel exploded')
}

// React reports every caught error on the console; the assertions below read that reporting,
// and letting it through would bury the run in stack traces it is meant to be catching.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('renders its children while nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>panel content</p>
      </ErrorBoundary>,
    )

    expect(screen.getByText('panel content')).toBeInTheDocument()
  })

  it('shows the failure notice instead of letting the error reach the window', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Ce panneau a rencontré une erreur.')).toBeInTheDocument()
  })

  it('renders a given fallback instead of the notice, for a surface too small to explain', () => {
    render(
      <ErrorBoundary fallback={null}>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.queryByText('Ce panneau a rencontré une erreur.')).not.toBeInTheDocument()
  })

  it('reports the error and the component stack, so a crash is not silent', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    const reported = vi.mocked(console.error).mock.calls.flat().join(' ')
    expect(reported).toContain('panel exploded')
    expect(reported).toContain('Boom')
  })

  it('renders the children again after a retry, once they stop throwing', async () => {
    // Outside the component on purpose: the boundary unmounts what threw, so state held
    // inside it would not survive to answer differently on the second attempt.
    let failing = true

    function Flaky() {
      if (failing) throw new Error('not yet')
      return <p>recovered</p>
    }

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Ce panneau a rencontré une erreur.')).toBeInTheDocument()

    failing = false
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(screen.getByText('recovered')).toBeInTheDocument()
  })
})
