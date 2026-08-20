import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

/**
 * A tree under a query client that never retries, ready to hand to `render` or `rerender`.
 *
 * Here rather than with any one panel: `Application.tsx` next door is what mounts the provider in
 * production, and the five suites that need one span five folders.
 *
 * Retries are the one option this sets, and the reason those suites configured a client by hand:
 * three more attempts stand between a failing query and the error state they assert on. The
 * production defaults it leaves out — `staleTime`, `refetchOnWindowFocus` (`Application.tsx`) —
 * none of the five carried either.
 *
 * Each call builds its OWN client. Five of the seven call sites already did; the two `rerender`
 * ones took the bare defaults, so they gain `retry: false` here. Handed to `rerender`, a fresh
 * client means a SECOND cache: an observer created on the first render keeps the client it was
 * built with, while anything mounted by that rerender subscribes to an empty one. Both sites that
 * do it assert on data the first render already settled.
 */
export function withQueries(ui: ReactNode): ReactElement {
  return <QueryClientProvider client={freshClient()}>{ui}</QueryClientProvider>
}

/**
 * The same host as a `renderHook` wrapper, holding ONE client across the rerenders a case drives —
 * which `withQueries` cannot be: called again by a rerender, it builds a second cache.
 */
export function queryHost(): (props: { children: ReactNode }) => ReactElement {
  const client = freshClient()

  return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}
