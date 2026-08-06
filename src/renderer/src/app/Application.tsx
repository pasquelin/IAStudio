import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { useDensity } from '@/hooks/useDensity'
import { useNativeMenu } from '@/hooks/useNativeMenu'
import { useWindowFit } from '@/hooks/useWindowFit'
import { Shell } from './Shell'

export function Application() {
  useNativeMenu()
  useWindowFit()
  // Settings are not wired to the main process yet; the default keeps the attribute present
  // so the CSS gauges resolve.
  useDensity(DEFAULT_SETTINGS.appearance.density)

  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      <Shell />
    </QueryClientProvider>
  )
}
