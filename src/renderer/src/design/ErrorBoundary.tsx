import { Component, type ErrorInfo, type ReactNode } from 'react'
import { PanelFailure } from './PanelFailure'

export type ErrorBoundaryProps = {
  children: ReactNode
  /** Shown instead of the panel notice, for a surface too small to explain itself — a header. */
  fallback?: ReactNode
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
    console.error('Panel failed to render:', error, info.componentStack)
  }

  private readonly retry = (): void => {
    this.setState({ failed: false })
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children
    // Compared to `undefined`, not `??`: `fallback={null}` means "show nothing", and `??`
    // would read that as "not given" and put the notice back.
    if (this.props.fallback !== undefined) return this.props.fallback
    return <PanelFailure onRetry={this.retry} />
  }
}
