import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useDensity } from '@/hooks/useDensity'
import { useNativeMenu } from '@/hooks/useNativeMenu'
import { useWindowFit } from '@/hooks/useWindowFit'
import { AccountDialog } from '@/settings/AccountDialog'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { Shell } from './Shell'

export function Application() {
  useNativeMenu()
  useWindowFit()

  const load = useSettings(state => state.load)
  const connect = useProject(state => state.connect)
  const density = useSettings(state => state.settings.appearance.density)

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const subscription = connect()
    return () => {
      void subscription.then(stop => stop())
    }
  }, [connect])

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
