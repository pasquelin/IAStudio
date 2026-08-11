import { Component, type ReactNode } from 'react'
import { Failure } from './Failure'

export type ErrorBoundaryProps = {
  children: ReactNode
  /** For a surface the notice does not suit — a header, a whole window. `() => null` shows nothing. */
  fallback?: (retry: () => void) => ReactNode
}

type ErrorBoundaryState = {
  failed: boolean
}

// A class: `getDerivedStateFromError` still has no hook equivalent in React 19. What it catches is
// reported by the root, so this file stays presentation, as all of `design/` is.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  private readonly retry = (): void => {
    this.setState({ failed: false })
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children

    const { fallback } = this.props
    return fallback ? fallback(this.retry) : <Failure scope="panel" onRetry={this.retry} />
  }
}
