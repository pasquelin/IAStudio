import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Failure } from './Failure'

export type ErrorBoundaryProps = {
  children: ReactNode
  /**
   * Shown instead of the panel notice. Always a function, so `() => null` says "nothing" —
   * a bare `null` would be indistinguishable from the prop being left out.
   */
  fallback?: (retry: () => void) => ReactNode
}

type ErrorBoundaryState = {
  failed: boolean
}

// A class: `getDerivedStateFromError` still has no hook equivalent in React 19.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // A render stack is renderer-local, and devtools is where it is read — unlike the API calls
    // CLAUDE.md sends to the main log, which never appear here at all.
    console.error('Render failed:', error, info.componentStack)
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
