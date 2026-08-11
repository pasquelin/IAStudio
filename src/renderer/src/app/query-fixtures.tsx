import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

/**
 * A tree under a query client that never retries, ready to hand to `render` or `rerender`.
 *
 * Here rather than with any one panel: `Application.tsx` next door is what mounts the provider in
 * production, and the five suites that need one span four folders.
 *
 * Retries are what the test client turns off, and the only thing: a suite asserting on a failed
 * query would otherwise wait out three more attempts before the error state it looks for appears.
 * The production defaults — `staleTime`, `refetchOnWindowFocus` — are deliberately NOT copied: a
 * cache that stays fresh across a suite would serve the previous test's answer to the next one.
 *
 * Each call builds its own client, as the five sites did by hand. A shared one would carry a
 * cache between tests.
 */
export function withQueries(ui: ReactNode): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>
}
