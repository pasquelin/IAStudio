import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { useMainLogs } from '@/hooks/useMainLogs'
import { useNativeMenu } from '@/hooks/useNativeMenu'
import { useWindowFit } from '@/hooks/useWindowFit'
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
  const connectProject = useProject(state => state.connect)
  const connectJobs = useJobs(state => state.connect)
  const connectMedia = useMedia(state => state.connect)

  useEffect(() => {
    const subscriptions = [connectSettings(), connectProject(), connectJobs(), connectMedia()]
    return () => {
      for (const subscription of subscriptions) void subscription.then(stop => stop())
    }
  }, [connectSettings, connectProject, connectJobs, connectMedia])

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

  return (
    <QueryClientProvider client={client}>
      <Shell />
    </QueryClientProvider>
  )
}
