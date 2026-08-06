import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useDensity } from '@/hooks/useDensity'
import { useNativeMenu } from '@/hooks/useNativeMenu'
import { useWindowFit } from '@/hooks/useWindowFit'
import { AccountDialog } from '@/settings/AccountDialog'
import { useSettings } from '@/stores/settings'
import { Shell } from './Shell'

export function Application() {
  useNativeMenu()
  useWindowFit()

  const load = useSettings(state => state.load)
  const density = useSettings(state => state.settings.appearance.density)

  useEffect(() => {
    void load()
  }, [load])

  useDensity(density)

  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      <Shell />
      <AccountDialog />
    </QueryClientProvider>
  )
}
