import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { useMainLogs } from '@/hooks/useMainLogs'
import { useNativeMenu } from '@/hooks/useNativeMenu'
import { useWindowFit } from '@/hooks/useWindowFit'
import { activeAccount, useAccounts } from '@/stores/accounts'
import { useJobs } from '@/stores/jobs'
import { useMedia } from '@/stores/media'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { connectSkyboxGeneration } from '@/stores/skybox-generation'
import { Shell } from './Shell'

export function Application() {
  useMainLogs()
  useNativeMenu()
  useWindowFit()

  const connectSettings = useSettings(state => state.connect)
  const connectAccounts = useAccounts(state => state.connect)
  const connectProject = useProject(state => state.connect)
  const connectJobs = useJobs(state => state.connect)
  const connectMedia = useMedia(state => state.connect)

  useEffect(() => {
    const subscriptions = [
      connectSettings(),
      connectAccounts(),
      connectProject(),
      connectJobs(),
      connectMedia(),
    ]
    return () => {
      for (const subscription of subscriptions) void subscription.then(stop => stop())
    }
  }, [connectSettings, connectAccounts, connectProject, connectJobs, connectMedia])

  // Store to store rather than through the main process, so it subscribes on its own: what a
  // generation launched from the Skyboxes workspace produced lands in the sky that asked.
  useEffect(() => connectSkyboxGeneration(), [])

  useAppliedSettings()

  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  )

  /*
   * Everything cached from the API belongs to the account that was active when it was fetched,
   * and none of the query keys say which. Without this, switching accounts leaves the previous
   * one's models and their signed previews on screen — nothing refetches them, since the keys
   * did not change and `refetchOnWindowFocus` is off.
   *
   * The main process clears its own caches on the same event (`onCredentialsChanged`).
   */
  useEffect(() => {
    /*
     * Watched on the store, not on the event: the first list arrives through `list()` and
     * never through `onChange`, so an event-side watcher would still be holding `null` when
     * the first broadcast lands and would clear the cache over an unrelated rename.
     */
    let active = activeAccount(useAccounts.getState().accounts)?.id ?? null

    return useAccounts.subscribe(state => {
      const next = activeAccount(state.accounts)?.id ?? null
      if (next === active) return

      // Nothing was fetched under "no account", so arriving at one has nothing to drop.
      const switched = active !== null
      active = next
      if (switched) client.clear()
    })
  }, [client])

  return (
    <QueryClientProvider client={client}>
      <Shell />
    </QueryClientProvider>
  )
}
