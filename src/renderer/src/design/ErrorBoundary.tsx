import { Component, type ErrorInfo, type ReactNode } from 'react'
import { PanelFailure } from './PanelFailure'

export type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  failed: boolean
}

/**
 * Keeps a throwing panel from taking the window with it. A class because React offers no hook
 * for this — `getDerivedStateFromError` has no functional equivalent in 19.
 *
 * One per panel rather than one at the root: a dock whose panels can be closed and reopened
 * individually should lose exactly the one that broke.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // The one place the renderer may reach the console (CLAUDE.md): a panel that fails in
    // silence looks like a panel that renders nothing, and the stack is the only way back.
    console.error('Panel failed to render:', error, info.componentStack)
  }

  private readonly retry = (): void => {
    this.setState({ failed: false })
  }

  override render(): ReactNode {
    if (this.state.failed) return <PanelFailure onRetry={this.retry} />
    return this.props.children
  }
}
